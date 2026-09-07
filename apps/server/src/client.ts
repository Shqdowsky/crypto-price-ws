import { createInterface } from "readline";
import { io, Socket } from "socket.io-client";
import { env } from "./config/env.js";
import { CLIENT_EVENTS, SERVER_EVENTS, ROOMS} from "./shared/constants.js";
import type { ClientToServerEvents, ServerToClientEvents, } from "./shared/types/socket.types.js";
import { isValidRoom } from "./socket/utils/room-check.js";

const BASE_URL = `http://localhost:${env.WS_PORT}`;

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const rl = createInterface({ input: process.stdin, output: process.stdout });

function prompt(question: string): Promise<string> {
    return new Promise((resolve) => rl.question(question, resolve));
}

function log(label: string, data: unknown): void {
    console.log(`\n[${label}]`, JSON.stringify(data, null, 2));
    process.stdout.write("> ");
}

function printMenu(): void {
    console.log(`
        Commands:
        join <token>       — subscribe to a room     (e.g. join btc)
        leave <token>      — unsubscribe from a room
        price <token>      — request current price
        buy <token>        — execute a buy trade
        sell <token>       — execute a sell trade
        history            — fetch your trade history
        exit               — disconnect and quit
    `);
    process.stdout.write("> ");
}

async function login(email: string, password: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
        const body = await res.json() as { message: string };
        throw new Error(`Login failed: ${body.message}`);
    }

    const { token } = await res.json() as { token: string };
    console.log(token)
    return token;
}

async function register(username: string, email: string, password: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
    });

    if (!res.ok) {
        const body = await res.json() as { message: string };
        throw new Error(`Register failed: ${body.message}`);
    }

    console.log("Registered successfully — you can now log in.");
}

function attachListeners(socket: ClientSocket): void {
    socket.on(SERVER_EVENTS.PRICE_UPDATE, (payload) => {
        log("price:update", payload);
    });

    socket.on(SERVER_EVENTS.PRICE_CURRENT, (payload) => {
        log("price:current", payload);
    });

    socket.on(SERVER_EVENTS.TRADE_CONFIRM, (payload) => {
        log("trade:confirm", payload);
    });

    socket.on(SERVER_EVENTS.HISTORY_RESULT, (payload) => {
        log("trade:history", payload);
    });

    socket.on(SERVER_EVENTS.RATE_LIMITED, (payload) => {
        log("rate-limited", `retry after ${payload.retryAfterMs}ms`);
    });

    socket.on(SERVER_EVENTS.ERROR, (payload) => {
        log("error", payload);
    });

    socket.on("disconnect", (reason) => {
        console.log(`\n[disconnected] ${reason}`);
    });
    
    socket.on("server_shutdown" as any, (payload: { message: string; reconnectAfterMs: number }) => {
        console.log(`\n[server_shutdown] ${payload.message}`);
    });
}

function startCommandLoop(socket: ClientSocket): void {
    printMenu();

    rl.on("line", (line) => {
        const parts = line.trim().split(/\s+/);
        const cmd = parts[0]?.toLowerCase();
        const arg = parts[1]?.toLowerCase();

        switch (cmd) {
            case "join":
                if (!arg || !isValidRoom(arg)) {
                    console.log(`Unknown token. Valid tokens: ${Object.values(ROOMS).join(", ")}`);
                    break;
                }
                socket.emit(CLIENT_EVENTS.SUBSCRIBE, arg);
                console.log(`Joining room: ${arg}`);
                break;

            case "leave":
                if (!arg || !isValidRoom(arg)) {
                    console.log(`Unknown token. Valid tokens: ${Object.values(ROOMS).join(", ")}`);
                    break;
                }
                socket.emit(CLIENT_EVENTS.UNSUBSCRIBE, arg);
                console.log(`Left room: ${arg}`);
                break;

            case "price":
                if (!arg || !isValidRoom(arg)) {
                    console.log(`Unknown token. Valid tokens: ${Object.values(ROOMS).join(", ")}`);
                    break;
                }
                socket.emit(CLIENT_EVENTS.GET_PRICE, arg);
                break;

            case "buy":
                if (!arg || !isValidRoom(arg)) {
                    console.log(`Unknown token. Valid tokens: ${Object.values(ROOMS).join(", ")}`);
                    break;
                }
                socket.emit(CLIENT_EVENTS.TRADE, { token: arg, side: "buy" });
                break;

            case "sell":
                if (!arg || !isValidRoom(arg)) {
                    console.log(`Unknown token. Valid tokens: ${Object.values(ROOMS).join(", ")}`);
                    break;
                }
                socket.emit(CLIENT_EVENTS.TRADE, { token: arg, side: "sell" });
                break;

            case "history":
                socket.emit(CLIENT_EVENTS.HISTORY);
                break;

            case "exit":
                console.log("Disconnecting...");
                socket.disconnect();
                rl.close();
                process.exit(0);

            default:
                console.log(`Unknown command: "${cmd}"`);
                printMenu();
        }

        process.stdout.write("> ");
    });
}

async function main(): Promise<void> {
    console.log("=== Crypto Tracker Console Client ===\n");
    console.log("1 — Login");
    console.log("2 — Register\n");

    const choice = await prompt("Choice: ");

    let jwt: string;

    if (choice.trim() === "2") {
        const username = await prompt("Username: ");
        const email = await prompt("Email: ");
        const password = await prompt("Password: ");
        await register(username, email, password);
        jwt = await login(email, password);
    } else {
        const email = await prompt("Email: ");
        const password = await prompt("Password: ");
        jwt = await login(email, password);
    }

    console.log("\nConnecting to server...");

    const socket: ClientSocket = io(BASE_URL, {
        auth: { token: jwt },
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
        console.log(`Connected — socket id: ${socket.id}`);
        startCommandLoop(socket);
    });

    socket.on("connect_error", (err: Error) => {
        console.error(`Connection failed: ${err.message}`);
        rl.close();
        process.exit(1);
    });

    attachListeners(socket);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});