import { SHUTDOWN } from "../../shared/constants.js"
import { Server } from "socket.io";
import { Pool } from "pg";
import http from "http";

let isShuttingDown = false;
 
const pendingOperations = new Map<string, number>();
 
export function incrementPending(socketId: string): void {
    pendingOperations.set(socketId, (pendingOperations.get(socketId) ?? 0) + 1);
}
 
export function decrementPending(socketId: string): void {
    const current = pendingOperations.get(socketId) ?? 0;
    pendingOperations.set(socketId, Math.max(0, current - 1));
}
 
function hasPendingOperations(socketId: string): boolean {
    return (pendingOperations.get(socketId) ?? 0) > 0;
}
 
export function cleanupSocket(socketId: string): void {
    pendingOperations.delete(socketId);
}
 
export function getIsShuttingDown(): boolean {
    return isShuttingDown;
}

function closeSocketGracefully(
    socket: {id: string, disconnect: (close: boolean) => void },
    timeoutMs: number
): Promise<void> {
    return new Promise((resolve) => {
        const deadline = Date.now() + timeoutMs;

        function attemptClose(){
            if(!hasPendingOperations(socket.id)){
                socket.disconnect(false);
                resolve();
                return;
            }
            if (Date.now() >= deadline) {
                console.log(
                    `[shutdown] Timeout exceeded for socket ${socket.id} - forcing disconnect`
                );
                socket.disconnect(true);
                resolve();
                return;
            }
            
            setTimeout(attemptClose, 100);
        }
        attemptClose();
    });
}

export async function gracefulShutdown(
    signal: string,
    io: Server,
    httpServer: http.Server,
    pool: Pool
): Promise<void>{
    if (isShuttingDown) {
        console.log("[shutdown] Already in progress, ignoring signal");
        return;
    }

    console.log(`\n[shutdown] ${signal} received - starting graceful shutdown`);
    isShuttingDown = true;

    const forceExitTimer = setTimeout(() => {
        console.error("[shutdown] Force exit: shutdown took too long");
        process.exit(1);
    }, SHUTDOWN.FORCE_EXIT_TIMEOUT_MS);

    forceExitTimer.unref();

    io.emit("server_shutdown", {
        message: "Server is shutting down. Please reconnect in a moment.",
        reconnectAfterMs: 3000,
    });

    const sockets = await io.fetchSockets();
    console.log(`[shutdown] Closing ${sockets.length} socket(s)...`);

    await Promise.all(
        sockets.map((s) => closeSocketGracefully(s, SHUTDOWN.SHUTDOWN_TIMEOUT_MS))
    );
    console.log("[shutdown] All sockets closed");
    
    await new Promise<void>((resolve, reject) => {
        io.close((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
    console.log("[shutdown] socket.io server closed");

    await pool.end();
    console.log("[shutdown] Postgres pool drained");
 
    clearTimeout(forceExitTimer);
    console.log("[shutdown] Shutdown complete");
    process.exit(0);
}