# claude-mods

개인용 Claude Code mod 모음.

| mod | 설명 |
| --- | --- |
| [branch-band](branch-band) | 프롬프트 위에 현재 git 브랜치, Jira 이슈 키(`PROJ-12` 형태), 기준 브랜치(`origin/HEAD`) 대비 커밋 수, 미커밋 파일 수, push 전 리뷰 상태를 띄운다. 5초마다 다시 읽는다. 리뷰 상태는 [아래 설정](#branch-band-push-전-리뷰-상태)을 한 저장소에서만 보인다. |
| [flyway-panel](flyway-panel) | 사이드 패널에 Flyway 마이그레이션(`db/migration/V{n}__*.sql`)을 **머지됨 / 내 작업 / 팀원 작업(머지 전 원격 브랜치)**으로 나눠 보여주고, 다음 번호와 번호 충돌을 알려준다. 3분마다 `git fetch`(작업 트리는 건드리지 않음)로 팀원 브랜치를 확인하고, 내 작업과 번호가 겹치면 알림을 띄운다. `/migrations`로 패널 열기·즉시 확인. |
| [guard-toast](guard-toast) | `.claude/settings*.json` 의 `PreToolUse` 훅이 도구 실행을 막으면 `🛡 secret-guard: .env 읽기 차단` 처럼 **어떤 훅이 무엇을 막았는지** 토스트로 알려준다. 막힌 내용이 대화 속 에러 한 줄로 지나가 놓치기 쉬운 걸 보완한다. |

## 동작 환경

- Claude Code 터미널 2.1.287 이상, 데스크톱 앱(Code 탭) 2.1.286 이상. 버전은 `/status` 로 확인
- branch-band 의 띠는 **터미널과 데스크톱 앱**에서만 보인다 (VS Code 확장 채팅 패널에는 프롬프트 위 띠가 없다)
- flyway-panel 의 패널은 터미널·데스크톱 앱·VS Code 확장(2.1.299 이상)에서 보인다
- `claude -p`, Agent SDK, 클라우드 세션(claude.ai/code)에서는 그려지지 않는다

## 설치

데스크톱 앱 (Code 탭): 입력창 옆 **+** → **Plugins** → **Add marketplace**에 `wisenick1/claude-mods` 입력 (로컬에서 개발할 때는 이 폴더 경로) → **Add plugin**에서 원하는 mod 선택

터미널 세션:

```
/plugin install branch-band --marketplace wisenick1/claude-mods
/plugin install flyway-panel --marketplace wisenick1/claude-mods
/plugin install guard-toast --marketplace wisenick1/claude-mods
```

셸:

```
claude plugin install branch-band --marketplace wisenick1/claude-mods
claude plugin install flyway-panel --marketplace wisenick1/claude-mods
claude plugin install guard-toast --marketplace wisenick1/claude-mods
```

### 업데이트·끄기

GitHub 로 설치했든 로컬 폴더로 설치했든, 세션은 설치 시점에 복사해 둔 캐시(`~/.claude/plugins/cache/claude-mods/<mod>/<버전>/`)를 읽는다. 원본 폴더를 고쳐도 바로 반영되지 않는다.

1. mod 를 고쳤으면 그 mod 의 `.claude-plugin/plugin.json` 에서 `version` 을 올린다 (버전이 같으면 업데이트해도 옛 캐시를 계속 쓸 수 있다)
2. `/plugin` (데스크톱 앱은 **+** → **Plugins**) 에서 마켓플레이스와 mod 를 업데이트한다. 셸에서는 `claude plugin update <mod>@claude-mods`
3. 새 세션을 연다

끄거나 지우려면 `/plugin` → Installed 탭 (데스크톱 앱은 **+** → **Plugins**).

### 실행하는 명령

mod 는 내 계정 권한으로 실행된다. 이 mod 들이 실행하는 것은 아래 git 명령뿐이고, 파일을 쓰거나 다른 네트워크 요청을 하지 않는다.

| mod | 명령 |
| --- | --- |
| branch-band (5초마다) | `git status --porcelain=v2 --branch`, `git rev-parse`, `git rev-list --count`, `.git/.reviewed-sha` 읽기 |
| flyway-panel (15초마다) | `git rev-parse`, `git ls-tree`, `git ls-files`, `git branch -r --no-merged` |
| flyway-panel (3분마다, `/migrations`) | `git fetch --prune origin` — 원격 브랜치 정보만 받고 내 작업 트리·로컬 브랜치는 바꾸지 않는다 |
| guard-toast | 명령을 실행하지 않는다. 훅의 결정을 읽기만 하고 그대로 전달한다 |

## branch-band

- **Jira 키**: 브랜치 이름에서 `대문자로 시작하는 프로젝트 키-숫자`(`PROJ-12`, `AB12CD-7`)를 찾는다. `fix/UTF-8` 처럼 키가 아닌 것도 키로 잡힐 수 있다.
- **기준 브랜치 대비 커밋 수가 안 보이면**: 원격 기본 브랜치(`origin/HEAD`)가 설정되지 않은 저장소다. 아래로 설정한다.
  ```
  git remote set-head origin -a
  ```
  기본 브랜치가 아닌 다른 브랜치(예: `dev`)를 기준으로 쓰려면 `git remote set-head origin dev`.
- **미커밋 N**: 커밋 안 된 파일 수 (새 파일 포함, `.gitignore` 된 파일 제외)

## flyway-panel

- `db/migration/V{번호}__{설명}.sql` 형식의 Flyway 버전 마이그레이션을 찾는다. 기준 브랜치(`origin/HEAD`)에 이런 파일이 하나도 없는 저장소에서는 패널을 열지 않는다.
- 패널은 세션이 시작될 때 열린다. 닫았으면 `/migrations` 로 다시 연다 (원격도 바로 다시 확인).
- **팀원 작업**은 기준 브랜치에 아직 머지되지 않은 **원격 브랜치**에서 찾는다. 팀원이 아직 push 하지 않은 작업은 알 수 없다.
- **다음 번호**는 머지됨·내 작업·팀원 작업을 통틀어 가장 큰 번호 + 1 이다.
- **⚠ 충돌**: 같은 번호를 서로 다른 파일이 쓰고 있다. 내 작업이 충돌에 새로 걸리면 알림이 뜬다. 먼저 머지될 쪽을 팀원과 정하고, 늦게 머지되는 쪽이 번호를 올린다.
- 상단에 "원격 저장소를 받아오지 못했어요"가 보이면 `git fetch` 가 실패한 것이다 (네트워크, 인증). 셸에서 `git fetch origin` 이 되는지 확인한다.

## guard-toast

- `PreToolUse` settings 훅이 막을 때(command 훅의 exit 2, 또는 `permissionDecision: "deny"`) 이유의 **첫 줄**을 6초 동안 보여준다.
- 훅 이름은 이렇게 찾는다. 이유가 `[이름] ` 으로 시작하면 그 이름을 쓰는 게 가장 확실하다.
  1. 이유가 `[secret-guard] .env 를 읽을 수 없습니다` 처럼 이름표로 시작하면 → `secret-guard`
  2. 이유 안에 훅 스크립트 경로가 있으면 그 파일 이름 → `secret-guard.js` 면 `secret-guard`
  3. 둘 다 없으면 도구 이름 → `Bash 훅`
- 훅의 결정은 바꾸지 않는다. 알림에 실패해도 훅의 결정은 그대로 적용된다.
- 조직이 Claude Code 를 관리(managed settings)하는 환경에서는, 조직이 지정하지 않은 플러그인의 `classic.PreToolUse` 훅이 실행되지 않아 알림이 뜨지 않는다.

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
