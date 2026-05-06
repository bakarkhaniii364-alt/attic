# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: communication.spec.ts >> Communication E2E Suite >> Real-Time Text & Typing
- Location: tests\communication.spec.ts:6:3

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e6]:
  - generic [ref=e7]:
    - heading "welcome back.exe" [level=2] [ref=e13]
    - button "Close" [ref=e16] [cursor=pointer]:
      - img [ref=e17]
  - generic [ref=e21]:
    - heading "welcome back" [level=2] [ref=e23]
    - generic [ref=e24]:
      - text: email
      - generic [ref=e25]:
        - img [ref=e26]
        - textbox "you@love.com" [active] [ref=e29]
    - generic [ref=e30]:
      - generic [ref=e31]:
        - text: password
        - generic [ref=e32]:
          - img [ref=e33]
          - textbox "••••••••" [ref=e36]
          - button [ref=e37] [cursor=pointer]:
            - img [ref=e38]
      - generic [ref=e41]:
        - generic [ref=e42] [cursor=pointer]:
          - checkbox "remember me" [ref=e43]
          - generic [ref=e44]: remember me
        - link "forgot password?" [ref=e45] [cursor=pointer]:
          - /url: /password-reset
    - button "enter attic" [ref=e46] [cursor=pointer]
    - generic [ref=e49]: or
    - generic [ref=e51]:
      - button "Magic Link" [ref=e52] [cursor=pointer]:
        - img [ref=e53]
        - text: Magic Link
      - button "Facebook" [ref=e56] [cursor=pointer]:
        - img [ref=e57]
        - text: Facebook
```