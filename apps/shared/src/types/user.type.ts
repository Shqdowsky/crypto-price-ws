export interface IUser{
    id: number;
    username: string;
    email: string;
    password: string;
}

export type PublicUser = Omit<IUser, "password">;