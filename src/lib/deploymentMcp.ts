export const packageURL='https://github.com/CBGPU-Engineering/CBGPU-mcp/releases/download/v1.0.1/cbgpu-deploy-mcp-1.0.1.tgz';
export const run=`npx --yes --package=${packageURL} cbgpu-deploy-mcp`;
export const deploymentMcpPrompt=`이 컴퓨터에서 사용하는 코딩 에이전트에 공식 CBGPU 배포 MCP를 설치하고 연결해 줘.
먼저 https://github.com/CBGPU-Engineering/CBGPU-mcp/blob/main/README.md 를 읽어 줘.
OS와 Node.js 22 이상 설치 여부, Codex/Claude Code CLI를 확인하고 README의 v1.0.1 패키지를 사용해 줘.
현재 사용하는 에이전트에 cbgpu-deploy라는 사용자 범위 stdio MCP를 등록하되 기존 설정은 보존해 줘.
로그인은 별도 대화형 터미널에서 내가 직접 CBGPU 이메일과 비밀번호를 입력하게 해 줘. 터미널을 제공할 수 없으면 실행할 로그인 명령어를 알려 줘.
비밀번호를 채팅에서 요구하거나 명령 인자·설정에 넣지 말고, 브라우저 세션이나 저장된 인증정보도 읽거나 출력하지 마.
연결 후 status와 frontend/server의 list_projects로 확인하고 에이전트 재시작이 필요한지 알려 줘.
설치 확인 중 프로젝트 생성·수정·재배포·삭제는 하지 마.
이후 내가 배포를 요청하면 저장소, 브랜치, 하위 폴더와 기존 프로젝트를 먼저 확인하고 알맞은 프론트/서버/Compose 방식으로 배포해 줘.
접수됐다고 성공으로 보고하지 말고 상태와 로그를 확인해 정상 실행 또는 실패 결과와 주소를 알려 줘. 로컬 .env나 비밀값을 채팅 또는 MCP 인자에 복사하지 마.`;
