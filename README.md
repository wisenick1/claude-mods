# claude-mods

개인용 Claude Code mod 모음.

| mod | 설명 |
| --- | --- |
| [branch-band](branch-band) | 프롬프트 위에 현재 git 브랜치, Jira 이슈 키(`PROJ-12` 형태), 기준 브랜치(`origin/HEAD`) 대비 커밋 수, 미커밋 파일 수, push 전 리뷰 상태를 띄운다. 5초마다 다시 읽는다. 리뷰 상태는 [아래 설정](#branch-band-push-전-리뷰-상태)을 한 저장소에서만 보인다. |
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

## branch-band: push 전 리뷰 상태

"어느 커밋까지 코드 리뷰를 마쳤는지"를 `<git-dir>/.reviewed-sha` 파일에 커밋 SHA 한 줄로 적어 두고, 띠가 그 값을 현재 HEAD 와 비교한다.

| 띠 | 뜻 |
| --- | --- |
| (표시 없음) | 이 저장소는 리뷰 기록을 쓰지 않음 (파일 없음), 또는 push 할 커밋이 없음 |
| 🔍 리뷰 필요 (빨강) | 기록이 없거나, 기록 이후 커밋이 더 생김 |
| ✓ 리뷰됨 (초록) | 지금 HEAD 까지 리뷰를 마침 |

**켜기** — 저장소마다 한 번, 빈 파일을 만든다 (`.git` 안이라 커밋되지 않는다):

```
touch "$(git rev-parse --git-dir)/.reviewed-sha"
```

**리뷰를 마칠 때마다** — 지적 사항을 반영해 **커밋한 뒤** 현재 HEAD 를 기록한다. 커밋 전에 기록하면 수정 전 커밋이 기록된다.

```
git rev-parse HEAD > "$(git rev-parse --git-dir)/.reviewed-sha"
```

**Claude 와 같이 쓰기** — 저장소의 `CLAUDE.md` 에 규칙을 적어 두면 Claude 가 리뷰 후 직접 기록한다. 예:

```markdown
## push 전 코드 리뷰
- push 전에 반드시 /code-review 로 origin/dev...HEAD 를 리뷰한다.
- 지적 사항을 반영해 커밋한 뒤 현재 HEAD SHA 를 기록한다:
  git rev-parse HEAD > "$(git rev-parse --git-dir)/.reviewed-sha"
```

리뷰 없이 push 하는 것까지 막고 싶다면, `git push` 직전에 HEAD 와 이 파일을 비교해 다르면 exit 2 로 막는 `PreToolUse`(Bash) 훅을 `.claude/settings.local.json` 에 등록하면 된다. 이 mod 는 표시만 하고 막지는 않는다.

## 개발

```
claude plugin validate <mod>
claude plugin test <mod>
```
