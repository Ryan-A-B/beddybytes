## Ownership and scope

- This `AGENTS.md` file is written and maintained by the human.
- You (the agent) may **read** this file but must **never modify it under any circumstances**.
- You are allowed to create and edit documentation **only** under the `agent_docs/` directory in this repository.
- Treat everything inside `agent_docs/` as your documentation workspace and Obsidian vault.

### Your responsibilities:

- Use existing documentation under `agent_docs/` before guessing.
- Keep documentation in `agent_docs/` in sync with the behavior of the code.
- Record meaningful domain knowledge there.

---

## Obsidian markdown conventions

You must treat `agent_docs/` as an Obsidian vault and follow these rules strictly:

- **File names are titles**
  - The file name is the note title. Do not add a level‑1 heading to restate the title.
  - Use natural, human‑readable names with spaces and standard capitalisation.
  - Example: `MQTT Topics and Payloads.md`, `Backend Overview.md`, `2026-03-08 Refactoring MQTT.md`.
  - Never use kebab‑case or snake_case file names (e.g. `mqtt-topics-and-payloads.md` is wrong).

- **Links between notes**
  - Always use Obsidian wiki links: `[[Note Name]]`.
  - The note name inside `[[...]]` must exactly match the file name (without the `.md` extension).
  - Example: `[[MQTT Topics and Payloads]]`, `[[Backend Overview]]`.
  - Never use standard markdown links for cross‑vault references.

---

## Documentation workspace: `agent_docs/`

- The root of your docs workspace is: `agent_docs/`.
- You **must not** create or edit docs outside `agent_docs/` unless explicitly asked.
- When you need to persist knowledge, decisions, or plans, write them into `agent_docs/`, not only into code comments (except for small, local notes).

You are expected to maintain at least:

- `agent_docs/index.md` - main index of all important notes.
- `agent_docs/structure.md` - where to find things in this repository
- `agent_docs/architecture.md` - the high level architecture of the project
