## Frontend Service Architecture

The frontend codebase generally works best when domain behavior lives in services and React stays focused on rendering.

## Preferred Split

- Services own domain state and transitions.
- Services own HTTP calls and long-running async workflows.
- Services own timers, retries, event subscriptions, and derived domain status.
- React components render state and invoke service commands.
- Hooks are thin adapters that subscribe React to service state.

## What Belongs in React

Keep state in React only when it is truly view-local:

- modal open or closed
- active tab
- local draft input before submit
- focus, hover, or animation state

If the state affects workflow, survives across screens, or mirrors backend/application behavior, it should usually move into a service.

## Existing Repository Patterns

- `frontend/src/services/Service.ts` provides a common base for stateful frontend services.
- `frontend/src/hooks/useServiceState.ts` is the standard hook shape for subscribing React to service state.
- `frontend/src/services/ParentStation/CountUpTimer.ts` is a concrete example where timer behavior is outside React.

## Practical Rule

If a React component starts accumulating fetch calls, retry logic, state-machine transitions, or several interdependent domain `useState` values, stop and extract a service.
