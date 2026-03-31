import { defineStore } from "pinia";

interface AuthStoreType {
    isLoggedIn: boolean;
    userId: string | number;
    username: string;
    userAvatar: string;
    locale: string;
    isAdmin: boolean;
}

interface UserInfo {
    isLoggedIn: boolean;
    id: string;
    attributes: {
        name: string;
        profile_picture: string;
        locale: string;
        admin: boolean;
    };
}

export const useAuthStore = defineStore({
    id: "authStore",
    state: (): AuthStoreType => ({
        isLoggedIn: false,
        userId: "",
        username: "Guest",
        userAvatar: "default",
        locale: "en",
        isAdmin: false,
    }),
    actions: {
        /**
         * Stores the auth token.
         * CircuitVerse returns a plain opaque token, not a JWT.
         * We store it and mark the user as logged in.
         * JWT parsing is not done here — the server validates the token.
         */
        setToken(token: string): void {
            if (!token || typeof token !== "string" || token.trim() === "") {
                console.error("[authStore] setToken called with empty token");
                return;
            }

            try {
                if (typeof localStorage !== "undefined") {
                    localStorage.setItem("cv_token", token);
                }
            } catch (err) {
                console.warn("[authStore] Could not persist token:", err);
            }

            this.isLoggedIn = true;
        },

        setUserInfo(userInfo: UserInfo): void {
            this.isLoggedIn = true;
            this.userId = userInfo.id ?? "";
            this.username = userInfo.attributes?.name ?? "Guest";

            if (userInfo.attributes?.profile_picture !== "original/Default.jpg") {
                this.userAvatar = userInfo.attributes?.profile_picture ?? "default";
            }

            this.locale = userInfo.attributes?.locale ?? "en";
            this.isAdmin = userInfo.attributes?.admin ?? false;
        },

        signOut(): void {
            this.isLoggedIn = false;
            this.userId = "";
            this.username = "Guest";
            this.userAvatar = "default";
            this.locale = "en";
            this.isAdmin = false;

            // Clear persisted token: prevents stale auth on next app start
            try {
                if (typeof localStorage !== "undefined") {
                    localStorage.removeItem("cv_token");
                }
            } catch (err) {
                console.warn("[authStore] Could not clear token:", err);
            }
        },
    },
    getters: {
        getIsLoggedIn(): boolean {
            return this.isLoggedIn;
        },
        getUserId(): string | number {
            return this.userId;
        },
        getUsername(): string {
            return this.username;
        },
        getUserAvatar(): string {
            return this.userAvatar;
        },
        getLocale(): string {
            return this.locale;
        },
        getIsAdmin(): boolean {
            return this.isAdmin;
        },
    },
});