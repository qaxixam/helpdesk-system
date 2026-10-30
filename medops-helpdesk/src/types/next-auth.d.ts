import { DefaultSession } from "next-auth";
import { UserRole } from "@/models/User";

declare module "next-auth" {
    interface User {
        id: string;
        role: UserRole;
        facility?: string;
    }

    interface Session {
        user: {
            id: string;
            role: UserRole;
            facility?: string;
        } & DefaultSession["user"];
    }
}