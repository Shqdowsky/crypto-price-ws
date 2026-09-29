import pool from "../../config/db.js";
import { TradeError, type RoomName } from "@crypto-price-ws/shared";
import type { OpenPosition, PositionRow, TradeExecutionResult, TradeRow } from "@crypto-price-ws/shared";
import {Decimal} from "decimal.js"
import type { PoolClient } from "pg";


interface ExecuteTradeParams  {
    userId: number;
    token: RoomName;
    side: "buy" | "sell";
    price: Decimal.Value;
    qty: Decimal.Value
}

interface PgError extends Error {
    code?: string;
}

const QTY_DP = 8;
const PRICE_DP = 8;
const PNL_DP = 2;
const MAX_RETRIES = 3;

export async function executeTrade(params: ExecuteTradeParams, attempt = 0): Promise<TradeExecutionResult> {
    const { userId, token, side, price, qty } = params;
    const qtyD = new Decimal(qty);
    const priceD = new Decimal(price);
    
    if (side !== 'buy' && side !== 'sell') throw new Error(`Invalid side: ${side}`);
    if (qtyD.lte(0)) throw new Error('Quantity must be positive');
    if (priceD.lte(0)) throw new Error('Price must be positive');

    const client = await pool.connect();
    try{
        await client.query("BEGIN");

        const { rows: userRows } = await client.query<{ id: number; balance: string }>(
            `SELECT id, balance FROM users WHERE id = $1 FOR UPDATE`,
            [userId]
        );
        const user = userRows[0];
        if (!user) throw new Error(`User ${userId} not found`);
        const currentBalance = new Decimal(user.balance);

        const { rows: posRows } = await client.query<PositionRow>(
            `
                SELECT * FROM positions
                WHERE user_id = $1 AND token = $2 AND status = 'open'
                FOR UPDATE
            `,
            [userId, token]
        );

        const position: PositionRow | null = posRows[0] ?? null;
        
        const cost = qtyD.times(priceD);

        let newBalance: Decimal;
        let updatedPosition: PositionRow;
        
        if(side === 'buy'){
            if (cost.gt(currentBalance)) {
                throw new TradeError(
                    "INSUFFICIENT_BALANCE",
                    `Insufficient balance: cost ${cost.toFixed(2)} exceeds balance ${currentBalance.toFixed(2)}`
                );
            }
            newBalance = currentBalance.minus(cost);
            updatedPosition = await applyBuy(client, userId, token, position, qtyD, priceD);
        }else {
            if (!position) {
                throw new TradeError(
                    "NO_OPEN_POSITION",
                    `No open position for user ${userId} on token "${token}"`);
            }
            if (qtyD.gt(new Decimal(position.quantity))) {
                throw new TradeError(
                    "SELL_EXCEEDS_POSITION",
                    `Sell quantity ${qtyD.toString()} exceeds open position quantity ${position.quantity}`
                );
            }
            newBalance = currentBalance.plus(cost);
            updatedPosition = await applySell(client, position, qtyD, priceD);
        }
    
        await client.query(
            `UPDATE users SET balance = $1 WHERE id = $2`,
            [newBalance.toFixed(2), userId]
        );

        const { rows: tradeRows } = await client.query<TradeRow>(
            `INSERT INTO trades (user_id, token, side, price, quantity, position_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, user_id, token, side, price, quantity, position_id, created_at`,
            [userId, token, side, priceD.toFixed(PRICE_DP), qtyD.toFixed(QTY_DP), updatedPosition.id]
        );
        const trade = tradeRows[0];
        if (!trade) throw new Error("Trade insert returned no rows"); 
        
        await client.query('COMMIT');
        
        return { position: updatedPosition, trade, balance: newBalance.toFixed(2) };

    }catch (err) {
        await client.query("ROLLBACK");
        if (err instanceof TradeError) throw err;
        const pgErr = err as PgError;
        if (pgErr.code === '23505' && side === 'buy' && attempt < MAX_RETRIES) {
            return executeTrade(params, attempt + 1);
        }
        throw err;
    } finally {
        client.release();
    }
}

async function applyBuy(
    client: PoolClient,
    userId: number,
    token: string,
    position: PositionRow | null,
    qty: Decimal,
    price: Decimal
):Promise<PositionRow>{
    if(!position){
        const insert = await client.query<PositionRow>(
            `
                INSERT INTO positions(user_id, token, status, quantity, avg_cost_basis, total_bought, total_sold, running_sell_total)
                VALUES ($1, $2, 'open', $3, $4, $5, 0, 0)
                RETURNING *
            `,
            [userId, token, qty.toFixed(QTY_DP), price.toFixed(PRICE_DP), qty.toFixed(QTY_DP)]
        )
        if (!insert.rows[0]) {
            throw new Error("Position insert returned no rows");
        }
        return insert.rows[0]!;
    }
    const oldQty = new Decimal(position.quantity);
    const oldAvg = new Decimal(position.avg_cost_basis);
    const newQty = oldQty.plus(qty);
    const newAvgCost = oldQty.times(oldAvg).plus(qty.times(price)).div(newQty);
    const newTotalBought = new Decimal(position.total_bought).plus(qty);
    
    const update = await client.query<PositionRow>(
        `
            UPDATE positions
            SET quantity = $1,
            avg_cost_basis = $2,
            total_bought = $3
            WHERE id = $4
            RETURNING *
        `,
        [newQty.toFixed(QTY_DP), newAvgCost.toFixed(PRICE_DP), newTotalBought.toFixed(QTY_DP), position.id]
    );

    if (!update.rows[0]) {
        throw new Error("Position update returned no rows");
    }
    return update.rows[0];
}

async function applySell(
    client: PoolClient,
    position: PositionRow,
    qty: Decimal,
    price: Decimal
): Promise<PositionRow> {
    const oldQty = new Decimal(position.quantity);
    const newQty = oldQty.minus(qty);
    const newTotalSold = new Decimal(position.total_sold).plus(qty);
    const newRunningSellTotal = new Decimal(position.running_sell_total).plus(qty.times(price));
 
    if (newQty.isZero()) {
        const avgSellPrice = newRunningSellTotal.div(newTotalSold);
        const avgCostBasis = new Decimal(position.avg_cost_basis);
        const realizedPnl = newRunningSellTotal.minus(avgCostBasis.times(newTotalSold));
    
        const update = await client.query<PositionRow>(
            `
                UPDATE positions
                SET quantity = 0,
                    total_sold = $1,
                    running_sell_total = $2,
                    avg_sell_price = $3,
                    realized_pnl = $4,
                    status = 'closed',
                    closed_at = now()
                WHERE id = $5
                RETURNING *
            `,
            [
                newTotalSold.toFixed(QTY_DP),
                newRunningSellTotal.toFixed(PRICE_DP),
                avgSellPrice.toFixed(PRICE_DP),
                realizedPnl.toFixed(PNL_DP),
                position.id,
            ]
        );
        if (!update.rows[0]) {
            throw new Error("Position update returned no rows");
        }
        return update.rows[0]!;
    }
    
    const update = await client.query<PositionRow>(
        `
            UPDATE positions
            SET quantity = $1,
                total_sold = $2,
                running_sell_total = $3
            WHERE id = $4
            RETURNING *
        `,
        [newQty.toFixed(QTY_DP), newTotalSold.toFixed(QTY_DP), newRunningSellTotal.toFixed(PRICE_DP), position.id]
    );
    if (!update.rows[0]) {
        throw new Error("Position update returned no rows");
    }
    return update.rows[0]!;
}

export function toOpenPosition(position: PositionRow): OpenPosition | null {
    if (position.status === 'closed') return null;
    return {
        id: position.id,
        token: position.token as RoomName,
        quantity: position.quantity,
        avgCostBasis: position.avg_cost_basis,
        totalBought: position.total_bought,
        totalSold: position.total_sold,
        openedAt: position.opened_at,
    };
}

export async function getTradesByUserId(userId:number): Promise<TradeRow[]> {
    const result = await pool.query<TradeRow>(
        `SELECT id, token, side, price, created_at
        FROM trades
        WHERE user_id = $1
        ORDER BY created_at DESC`,
        [userId]
    );

    return result.rows;
}
