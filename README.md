# claude-mods

개인용 Claude Code mod 모음.

| mod | 설명 |
| --- | --- |
| [branch-band](branch-band) | 프롬프트 위에 현재 git 브랜치, Jira 이슈 키(`PROJ-12` 형태), 기준 브랜치(`origin/HEAD`) 대비 커밋 수, 미커밋 파일 수, push 전 리뷰 상태(`.git/.reviewed-sha` 와 HEAD 비교)를 띄운다. 5초마다 다시 읽는다. |
| [flyway-panel](flyway-panel) | 사이드 패널에 Flyway 마이그레이션(`db/migration/V{n}__*.sql`)을 **머지됨 / 내 작업 / 팀원 작업(머지 전 원격 브랜치)**으로 나눠 보여주고, 다음 번호와 번호 충돌을 알려준다. 3분마다 `git fetch`(작업 트리는 건드리지 않음)로 팀원 브랜치를 확인하고, 내 작업과 번호가 겹치면 알림을 띄운다. `/migrations`로 패널 열기·즉시 확인. |

## 설치

데스크톱 앱 (Code 탭): 입력창 옆 **+** → **Plugins** → **Add marketplace**에 `wisenick1/claude-mods` 입력 (로컬에서 개발할 때는 이 폴더 경로) → **Add plugin**에서 원하는 mod 선택

터미널 세션:

```
/plugin install branch-band --marketplace wisenick1/claude-mods
/plugin install flyway-panel --marketplace wisenick1/claude-mods
```

셸:

```
claude plugin install branch-band --marketplace wisenick1/claude-mods
claude plugin install flyway-panel --marketplace wisenick1/claude-mods
```

## 개발

```
claude plugin validate <mod>
claude plugin test <mod>
```
