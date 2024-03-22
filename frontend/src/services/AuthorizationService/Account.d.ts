interface User {
    id: string
    email: string
    password_salt: string
    password_hash: string
}

interface Account {
    id: string
    user: User
}