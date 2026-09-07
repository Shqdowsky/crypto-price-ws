export interface IUser{
    id: string;
    username: string;
    email: string;
    password: string;
}

export type PublicUser = Omit<IUser, "password">;