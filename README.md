# claude-mods

개인용 Claude Code mod 모음.

| mod | 설명 |
| --- | --- |
| [branch-band](branch-band) | 프롬프트 위에 현재 git 브랜치와 Jira 이슈 키(`PROJ-12` 형태)를 띄운다. 5초마다 브랜치를 다시 읽는다. |

## 설치

데스크톱 앱 (Code 탭): 입력창 옆 **+** → **Plugins** → **Add marketplace**에 `wisenick1/claude-mods` 입력 (로컬에서 개발할 때는 이 폴더 경로) → **Add plugin**에서 `branch-band` 선택

터미널 세션:

```
/plugin install branch-band --marketplace wisenick1/claude-mods
```

셸:

```
claude plugin install branch-band --marketplace wisenick1/claude-mods
```

## 개발

```
claude plugin validate branch-band
claude plugin test branch-band
```
