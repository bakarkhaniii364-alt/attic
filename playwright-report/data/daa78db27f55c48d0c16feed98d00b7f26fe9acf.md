# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: calling.spec.ts >> Full WebRTC Audio Call Flow
- Location: tests\calling.spec.ts:4:1

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - img [ref=e6] [cursor=pointer]
    - generic:
      - generic [ref=e13]: Bliss
      - generic [ref=e16]:
        - button [ref=e17] [cursor=pointer]:
          - img [ref=e18]
        - slider [ref=e22] [cursor=pointer]: "0.4"
      - generic [ref=e23]:
        - button [ref=e24] [cursor=pointer]:
          - img [ref=e25]
        - button [ref=e27] [cursor=pointer]:
          - img [ref=e28]
        - button [ref=e30] [cursor=pointer]:
          - img [ref=e31]
  - generic [ref=e33]:
    - generic [ref=e42]:
      - generic [ref=e43]:
        - img [ref=e45]
        - generic [ref=e47]: User B
        - generic [ref=e48]: "|"
        - generic [ref=e49]: ···
      - generic [ref=e50]:
        - button "Minimize" [ref=e51] [cursor=pointer]:
          - img [ref=e52]
        - button "End Call" [ref=e57] [cursor=pointer]:
          - img [ref=e58]
    - generic [ref=e61]:
      - generic [ref=e62]:
        - img [ref=e65]
        - paragraph [ref=e67]: Ringing User B…
      - generic [ref=e68]:
        - button "Mute (Shift+M)" [ref=e69] [cursor=pointer]:
          - img [ref=e70]
        - button "Deafen (Shift+D)" [ref=e73] [cursor=pointer]:
          - img [ref=e74]
        - button "Camera (Shift+V)" [ref=e78] [cursor=pointer]:
          - img [ref=e79]
        - button "Screen Share (Shift+S)" [ref=e83] [cursor=pointer]:
          - img [ref=e84]
        - button [ref=e88] [cursor=pointer]:
          - img [ref=e89]
        - button "Raise Hand" [ref=e92] [cursor=pointer]:
          - img [ref=e93]
        - button "Device Settings" [ref=e100] [cursor=pointer]:
          - img [ref=e101]
        - button "End Call (Shift+E)" [ref=e105] [cursor=pointer]:
          - img [ref=e106]
  - generic [ref=e110]:
    - generic [ref=e111]:
      - heading "User B | offline" [level=2] [ref=e117] [cursor=pointer]
      - generic [ref=e119]:
        - generic [ref=e120]:
          - button "Voice Call" [active] [ref=e121] [cursor=pointer]:
            - img [ref=e122]
          - button "Video Call" [ref=e124] [cursor=pointer]:
            - img [ref=e125]
        - button "Close" [ref=e128] [cursor=pointer]:
          - img [ref=e129]
    - generic [ref=e134]:
      - generic [ref=e135]:
        - generic [ref=e136]: "-- connection secured --"
        - button "↑ Load Older Messages" [ref=e137] [cursor=pointer]
        - generic [ref=e142]:
          - img [ref=e144]
          - generic [ref=e146]:
            - generic [ref=e147]: Call
            - generic [ref=e148]: 10:08 PM
      - generic [ref=e151]:
        - generic [ref=e152]:
          - button [ref=e153] [cursor=pointer]:
            - img [ref=e154]
          - button [ref=e156] [cursor=pointer]:
            - img [ref=e157]
        - textbox "type a message..." [ref=e161]
        - button [ref=e162] [cursor=pointer]:
          - img [ref=e163]
```