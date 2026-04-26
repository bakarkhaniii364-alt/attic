## Testing Rules
- Framework: Playwright with TypeScript.
- Locator strategy: ALWAYS prefer `getByRole` or `getByTestId`. 
- Never use raw CSS class selectors for testing.
- Focus on: Authentication flows, Real-time synchronization (Chat/Pictionary), and Game state persistence.
