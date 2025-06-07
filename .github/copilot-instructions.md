There are 3 primary components in this repository: frontend, backend and marketing.

# Frontend
Is a React app created using create-react-app which resides in the `frontend` folder
`scripts/frontend/test.sh` can be used to run the frontend unit tests

# Backend
The backend is written in golang the main func is found in `golang/cmd/backend/server.go`. Data is persisted in an event store and held in memory at runtime. 
`go test ./...` can be used to run the backend unit tests

# Marketing
Is a React frontend created using gatsby.

# Testing
The local stack can be run by calling `run_local_stack.sh`. This will start a docker compose cluster.
The integration tests require a running stack and can be run by calling `run_integration_tests.sh`.

# Javascript
Use arrow functions.
Use `const` and `let` instead of `var`.
Instead of using let prefer using a function that returns a value.
Use `===` and `!==` instead of `==` and `!=`.