import { Routes,Route } from "react-router";
import { ProtectedRoute } from "./guards/ProtectedRoute";
import { PublicOnlyRoute } from "./guards/PublicOnlyRoute";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { SocketProvider } from "../context/socket/SocketProvider";
import { Dashboard } from "../pages/Dashboard";

export function AppRoutes(){
    return(
        <Routes>
            <Route path="/login" element={<PublicOnlyRoute><LoginPage/></PublicOnlyRoute>} />
            <Route path="/register" element={<PublicOnlyRoute><RegisterPage/></PublicOnlyRoute>} />
            <Route path="/" element={
                <ProtectedRoute>
                    <></>
                    <SocketProvider>
                        <Dashboard />
                    </SocketProvider>
                </ProtectedRoute>
            } />
        </Routes>
    )
}