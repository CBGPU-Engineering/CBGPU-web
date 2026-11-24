export const packageURL='https://github.com/CBGPU-Engineering/CBGPU-mcp/releases/download/v1.2.0/cbgpu-deploy-mcp-1.2.0.tgz';
export const run=`npx --yes --package=${packageURL} cbgpu-deploy-mcp`;
export const deploymentMcpPrompt=`이 컴퓨터에서 사용하는 코딩 에이전트에 공식 CBGPU 배포 MCP를 설치하고 연결해 줘.
먼저 https://github.com/CBGPU-Engineering/CBGPU-mcp/blob/main/README.md 를 읽어 줘.
OS와 Node.js 22 이상 설치 여부, Codex/Claude Code CLI를 확인하고 README의 v1.2.0 패키지를 사용해 줘.
현재 사용하는 에이전트에 cbgpu-deploy라는 사용자 범위 stdio MCP를 등록해 줘. 이미 등록되어 있으면 이 항목만 새 버전으로 갱신하고 다른 MCP 설정은 보존해 줘.
로그인은 별도 대화형 터미널에서 내가 직접 CBGPU 이메일과 비밀번호를 입력하게 해 줘. 터미널을 제공할 수 없으면 실행할 로그인 명령어를 알려 줘.
비밀번호를 채팅에서 요구하거나 명령 인자·설정에 넣지 말고, 브라우저 세션이나 저장된 인증정보도 읽거나 출력하지 마.
연결 후 status와 frontend/server의 list_projects로 확인하고 에이전트 재시작이 필요한지 알려 줘.
설치 확인 중 프로젝트 생성·수정·재배포·삭제는 하지 마.
이후 내가 배포를 요청하면 저장소, 브랜치, 하위 폴더와 기존 프로젝트를 먼저 확인하고 알맞은 프론트/서버/Compose 방식으로 배포해 줘.
접수됐다고 성공으로 보고하지 말고 상태와 로그를 확인해 정상 실행 또는 실패 결과와 주소를 알려 줘. 환경변수 설정을 요청하면 내가 지정한 .env 파일의 절대 경로를 set_environment_from_file에 넘겨 설정하고, 비밀값은 채팅이나 도구 결과에 출력하지 마. 환경변수 변경 후에는 재배포해야 적용돼.
서버에서 명령 실행을 요청하면 프로젝트와 서비스를 먼저 확인해 줘. 내가 소유한 실행 중인 Compose 배포에서 list_server_services로 서비스 이름을 찾고, run_server_command에 실행 파일과 인자를 배열로 넘겨 줘. 명령 실행이 상태를 바꾼다면 요청한 작업 범위인지 확인해 줘.`;
