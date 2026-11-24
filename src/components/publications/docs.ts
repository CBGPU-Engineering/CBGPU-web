import {run as deploymentMcpRun,deploymentMcpPrompt} from '@/lib/deploymentMcp';
export const docCategories = [
  {
    "id": "start",
    "title": "시작·계정"
  },
  {
    "id": "school",
    "title": "학교생활"
  },
  {
    "id": "research",
    "title": "GPU·연구"
  },
  {
    "id": "deploy",
    "title": "배포·협업"
  },
  {
    "id": "making",
    "title": "제작"
  },
  {
    "id": "community",
    "title": "대회·커뮤니티"
  },
  {
    "id": "operations",
    "title": "담당자·관리자"
  },
  {
    "id": "help",
    "title": "도움말"
  }
] as const;
export type DocCategoryId=typeof docCategories[number]['id'];
export type GuideSection={title:string;body:string;steps?:string[];code?:string;links?:{label:string;href:string;newTab?:boolean}[]};
export type Guide={updatedAt?:string;slug:string;title:string;description:string;category:DocCategoryId;features:string[];sections:GuideSection[];related:string[];keywords?:string[]};
export const guides:Guide[] = [
  {
    slug:'school-clubs',title:'동아리 홍보와 지원',category:'school',updatedAt:'2026-11-24',
    description:'우리 학교의 동아리를 살펴보고 지원하세요. 학교 담당자는 필요할 때마다 모집을 열 수 있어요.',
    features:['/clubs'],keywords:['동아리','홍보','모집','지원'],related:['school-integration'],
    sections:[
      {title:'우리 학교 동아리 찾기',body:'로그인한 계정의 학교를 기준으로 보여줘요. 학교를 바꾸면 해당 학교의 모집을 확인할 수 있어요. 홍보 기간에 공개된 글을 살펴보고, 지원 기간에 지원해 주세요. 모집이 열리기 전에는 학교 담당자가 정한 일정을 확인하세요.'},
      {title:'동아리 홍보 글 준비하기',body:'학교 담당자가 모집을 열면 홍보 글을 초안으로 준비하세요. 등록 기간 안에 준비 완료로 바꾸면 홍보 기간에 자동으로 보여요. 초안은 공개되지 않아요. 지원자는 내 지원 상태를 확인하고 지원을 취소할 수 있어요.'},
      {title:'학교 담당자가 모집 열기',body:'학교 관리자 화면의 동아리 모집에서 회차 이름과 세 기간을 설정하세요. 매년 한 번으로 제한되지 않아요. 새 학기 모집이나 추가 모집처럼 필요할 때 다시 열 수 있어요.',steps:['홍보 글 등록 기간: 동아리 운영자가 글을 준비하고 등록하는 기간이에요.','홍보 기간: 준비 완료된 글을 학생들에게 보여주는 기간이에요.','지원 접수 기간: 학생들이 지원할 수 있는 기간이에요. 홍보 기간 안에 설정하세요.','한국 시간을 확인하고 저장하세요. 잠시 멈추더라도 기존 글과 지원 기록은 유지돼요.']},
      {title:'지원자 정보와 권한',body:'지원과 홍보 글 관리는 학교 소속과 권한을 서버에서 확인해요. 동아리 운영자는 본인 동아리의 지원자를 검토해요. 학교 관리자는 모집 현황과 지원 내용을 확인하고 모집을 관리할 수 있어요. 기간이 끝나도 기록을 자동으로 삭제하지 않아요.'}
    ]
  },

  {
  "slug": "school-integration",
  "title": "우리 학교에 CBGPU 도입하기",
  "description": "먼저 우리 학교가 이미 도입됐거나 다른 담당자가 신청했는지 확인하세요. 새 도입이 필요할 때 디스코드 참여부터 학교 신청, 구성원 가입, 학교생활 연동까지 따라가세요. GPU 서버는 없어도 괜찮아요.",
  "category": "start",
  "updatedAt": "2026-11-21",
  "keywords": [
    "학교 도입",
    "학교 통합",
    "학교 연동",
    "새 학교",
    "학교 관리자",
    "디스코드",
    "학교 시간표"
  ],
  "features": [],
  "related": [
    "schools",
    "school-setup",
    "school-administration",
    "school-custom-features",
    "gpu-notebook",
    "guest-school-access"
  ],
  "sections": [
    {
      "title": "먼저 우리 학교의 도입·신청 여부를 확인해요",
      "body": "학교 찾기에서 정식 학교 이름과 지역을 확인하고, 교내 담당자에게 이미 도입을 신청한 사람이 있는지 먼저 물어보세요. 나이스(NEIS) 공식 학교 목록에 검색되는 것과 CBGPU 도입 승인은 달라요. ‘아직 등록되지 않은 학교입니다’로 보여도 다른 사람이 신청을 진행 중일 수 있어요.",
      "steps": [
        "‘이미 도입됐어요’가 표시되면 이미 도입된 학교예요. 로그인한 구성원에게는 가입·전환이나 소속 상태도 표시될 수 있어요. 새 도입 신청 대신 구성원 가입·소속 확인을 진행하세요. 새 운영 담당자는 기존 담당자나 운영팀에 관리자 접근을 문의하세요.",
        "‘아직 등록되지 않은 학교입니다’이면 공식 학교 정보만 있는 상태예요. ‘우리 학교에 도입하기’를 누르면 이 안내로 연결되고, 선택한 학교로 도입 신청을 이어갈 수 있어요. 도입이 완료됐다는 뜻도, 다른 사람의 신청이 없다는 뜻도 아니에요.",
        "교내 담당자가 이미 신청했다면 중복 신청하지 말고 그 담당자와 진행 상황을 확인하세요. 신청자는 본인 계정의 ‘내 학교 신청 확인’에서 초안·승인 대기·승인됨 상태를 확인할 수 있어요. 이 화면을 다른 사람의 신청까지 조회하는 목록으로 사용하지 마세요.",
        "신청한 사람이 있는지 확실하지 않거나 ‘학교 운영 일시 중지’가 보이면 새로 신청하기 전에 운영팀에 학교 이름·지역을 알려 확인하세요. 이미 도입됐거나 신청 중인 학교는 재신청하지 않아요.",
        "기존 도입·신청이 없음을 확인했다면 아래 디스코드 참여 안내부터 새 학교 도입을 진행하세요."
      ],
      "links": [
        {"label": "우리 학교 도입 여부 확인", "href": "https://cbgpu.com/schools"},
        {"label": "내 학교 신청 확인", "href": "https://cbgpu.com/schools/new"},
        {"label": "신청 여부가 불확실해요 · 문의", "href": "https://cbgpu.com/contact"}
      ]
    },
    {
      "title": "디스코드에서 함께 시작해요",
      "body": "학교 도입 담당자는 CBGPU 안내·지원 디스코드에 꼭 참여해 주세요. 이미 들어와 있다면 다시 가입하거나 초대 링크를 누를 필요 없이 바로 학교 찾기로 가세요. 처음이라면 아래 초대 링크로 참여한 뒤 돌아오세요. 도입 안내를 받고, 설정이 어렵거나 오류가 생겼을 때 도움을 요청할 수 있어요. 신청에 디스코드 사용자명은 입력하지 않아요. 일반 학생 모두가 참여해야 하는 것은 아니에요.",
      "links": [
        {
          "label": "이미 참여했어요 · 학교 찾기",
          "href": "https://cbgpu.com/schools"
        },
        {
          "label": "처음이에요 · 디스코드 참여",
          "href": "https://discord.gg/cuqEvDDEcH", "newTab": true
        }
      ]
    },
    {
      "title": "이것만 준비해 주세요",
      "body": "학교를 맡아 운영할 담당자 한 명과 본인의 CBGPU 계정이 필요해요. 학생 운영자도 신청할 수 있어요. 이미 다른 학교에서 쓰던 계정이 있다면 새 계정을 만들지 않아도 돼요.",
      "steps": [
        "학교의 정식 이름·지역과 공식 홈페이지 주소를 준비해요.",
        "학교 연락 이메일과 신청자 연락 이메일, 학교에서 맡은 역할을 확인해요. 학교 연락 이메일은 해당 학교의 CBGPU 관리자에게 연락할 주소예요. 신청하는 본인의 개인 이메일을 입력해도 돼요.",
        "어떤 기능부터 사용할지 정해요. GPU 서버나 나이스 API 인증키부터 준비할 필요는 없어요.",
        "기존 담당자가 이미 신청했다면 중복 신청하지 말고, 그 담당자와 진행 상황을 확인해요."
      ],
      "links": [
        {
          "label": "CBGPU 로그인",
          "href": "https://cbgpu.com/auth/login"
        }
      ]
    },
    {
      "title": "우리 학교를 찾아요",
      "body": "학교 찾기 화면에서 이름이나 지역으로 검색하세요. 공식 목록에 있다고 해서 CBGPU 도입이 끝난 것은 아니에요. 학교 카드의 상태에 따라 다음 버튼이 달라져요.",
      "steps": [
        "‘학교 소속 요청’이 보이면 이미 운영 중인 학교예요. 일반 구성원은 이 버튼으로 가입하고, 새 운영 담당자는 기존 담당자나 운영팀에 관리자 접근을 문의하세요.",
        "‘공식 학교 목록 · 아직 도입 전’이고 기존 담당자의 신청도 없다면 그 학교의 ‘학교 도입 신청’을 누르세요. 정식 학교 정보가 연결된 신청으로 이동해요.",
        "‘선택한 공식 학교로 초안 만들기’를 누르세요. 학교를 검색할 때 지역과 정식 이름을 함께 확인해요.",
        "끝까지 검색해도 없다면 도입 신청 화면에서 ‘공식 목록에 없는 학교를 직접 신청할게요’를 선택하세요. 운영팀이 학교 정보와 연동 가능 여부를 확인해요."
      ],
      "links": [
        {
          "label": "학교 찾아서 시작하기",
          "href": "https://cbgpu.com/schools"
        },
        {
          "label": "학교 도입 신청 열기",
          "href": "https://cbgpu.com/schools/new"
        }
      ]
    },
    {
      "title": "학교와 담당자 정보를 입력해요",
      "body": "도입 신청은 여섯 단계예요. 화면에서 입력하고 ‘다음’을 누르면 돼요. 공식 목록에서 선택한 학교의 식별 정보는 중복·오연결을 막기 위해 수정이 제한될 수 있어요.",
      "steps": [
        "‘우리 학교를 알려 주세요’: 학교 정보와 연락 이메일을 확인해요. 학교 연락 이메일에는 신청하는 본인의 개인 이메일을 입력해도 돼요. 학교에서 발급한 이메일이 아니어도 괜찮아요. 공식 식별번호를 모르면 직접 추측하지 마세요.",
        "‘어떤 분이 운영하나요?’: 이름, 학교 내 역할, 학교와의 관계와 연락 이메일을 입력해요.",
        "운영 관계 확인 내용에는 예를 들어 ‘학생 운영자로, 담당 교사와 함께 교내 서비스 도입을 진행해요’처럼 실제 역할을 적어 주세요. 비밀번호나 인증 토큰을 적으면 안 돼요.",
        "중간에 멈출 때는 ‘초안 저장’을 누르세요. 같은 CBGPU 계정으로 도입 신청 화면을 다시 열면 저장한 신청을 이어갈 수 있어요."
      ]
    },
    {
      "title": "학교 정책과 기능을 골라요",
      "body": "‘학교에 맞게 설정해요’에서 표시 이름·색상 등 화면에 제공되는 설정을 확인하고, ‘필요한 기능을 골라주세요’에서 사용할 기능을 선택해요. 처음에는 필요한 기능만 골라도 괜찮아요.",
      "steps": [
        "다른 학교는 보통 ‘학교별 학생 번호’ 정책을 사용해요. 충북과고의 네 자리 학번 규칙을 다른 학교에 그대로 적용하지 마세요.",
        "시간표·급식·학교 소식을 사용하려면 ‘학교생활’을 선택하세요. 기본으로 선택된 커뮤니티·프로젝트·대회만으로는 학교생활 연동이 켜지지 않아요.",
        "GPU가 없어도 커뮤니티·프로젝트 기록·대회 운영 등으로 시작할 수 있어요.",
        "AI나 서버 실행 기능은 별도의 이용 정책과 자원 승인이 필요할 수 있어요. 기능 선택만으로 연산 자원이나 다른 학교 GPU 권한이 생기지는 않아요."
      ]
    },
    {
      "title": "GPU는 없어도 돼요",
      "body": "‘GPU 서버는 나중에 연결해도 돼요’에서 현재 상황에 맞는 항목을 고르세요. GPU 연결은 학교 등록의 필수 조건이 아니에요.",
      "steps": [
        "서버가 없다면 ‘GPU 서버 없이 시작할게요’를 선택하세요.",
        "나중에 준비한다면 ‘나중에 연결할게요’를 선택하세요. Daemon을 설치하지 않고 다음 단계로 갈 수 있어요.",
        "‘연결 준비도 함께 할게요’도 승인 전에는 연결 계획을 저장하는 단계예요. 신청 즉시 서버가 설치되거나 인터넷에 공개되는 것은 아니에요."
      ]
    },
    {
      "title": "신청을 보내고 승인을 기다려요",
      "body": "‘신청 내용을 확인해 주세요’에서 학교·운영자·선택 기능을 확인하고 디스코드 참여 중임과 승인 전 권한 안내에 동의한 뒤 ‘도입 신청 보내기’를 누르세요. 학교 운영 관계와 중복 여부를 확인한 후 승인해요. 제출 직후 관리자 권한이 자동으로 생기지는 않아요.",
      "steps": [
        "신청 화면에서 ‘승인 대기’ 상태를 확인하세요. 같은 학교를 다시 신청하지 않아도 돼요.",
        "설명이 더 필요하거나 진행이 막히면 디스코드에서 학교 이름과 어떤 단계인지 알려 주세요. 학생 명단이나 개인정보를 공개 채널에 올리지 마세요.",
        "추가 설명이나 수정 요청을 받으면 운영팀에 필요한 내용을 전달하고, 수정 가능한 초안이나 다음 진행 방법을 안내받으세요. 제출한 신청을 수정하려면 운영팀에 문의해 주세요.",
        "도입 신청 승인과 학생·교사 개인의 소속 승인은 서로 다른 절차예요."
      ],
      "links": [
        {
          "label": "내 학교 신청 확인",
          "href": "https://cbgpu.com/schools/new"
        },
        {
          "label": "디스코드에서 도움받기",
          "href": "https://discord.gg/cuqEvDDEcH", "newTab": true
        }
      ]
    },
    {
      "title": "승인 후 학교 관리로 들어가요",
      "body": "승인된 신청 화면의 학교 관리 진입 버튼을 사용하세요. 로그인한 계정에 해당 학교의 인증된 관리자 소속이 있어야 해요. 교사 계정이라고 자동으로 학교 관리자가 되는 것은 아니에요.",
      "steps": [
        "신청 승인 상태와 관리자 소속 확인이 모두 끝났는지 확인해요. 버튼이 안 보이거나 권한 확인 중이면 화면을 새로고침하고 운영팀에 문의하세요.",
        "학교 관리에서 구성원, 설정, 학교생활 연동, GPU 서버 메뉴를 필요한 순서로 열어요.",
        "학교가 여러 개라면 현재 선택한 학교 이름을 먼저 확인해요. 다른 학교를 선택했다고 기존 계정이나 프로젝트가 삭제되지는 않아요.",
        "설정에서 기능을 켜는 것과 실제 제공처 연결은 달라요. 연동 메뉴의 상태도 함께 확인하세요."
      ]
    },
    {
      "title": "학생·교사에게 학교 소속 요청을 안내해요",
      "body": "학교 운영 승인이 끝나면 구성원에게 학교 찾기 주소를 공유하세요. 일반 학생은 학교 등록 마법사를 다시 작성하거나 디스코드에 전부 들어올 필요가 없어요. 이메일 인증과 학교 소속 인증은 별개예요.",
      "steps": [
        "새 구성원은 CBGPU에 로그인하고 학교 찾기에서 정확한 학교의 ‘학교 소속 요청’을 눌러요. 이미 인증된 구성원이라면 재가입하지 말고 ‘현재 학교’ 또는 ‘이 학교로 전환’을 사용하세요.",
        "학생·교사 등 본인에게 맞는 유형을 선택하고 학교에서 쓰는 학생 번호나 필요한 정보를 입력해요. 다른 학교의 학생 번호는 1–80자 범위에서 학교 정책에 맞게 사용해요.",
        "관리자는 학교 관리의 구성원 목록에서 대상과 학생 번호를 확인하고 소속 검토 → 승인 → 최종 확인 순서로 처리해요. 본인의 소속·권한 요청을 스스로 승인할 수는 없어요.",
        "학교 도입 담당자도 학생·교사 소속 확인이 따로 필요할 수 있어요. 내 정보의 학교별 학생·교사 소속 확인 요청을 사용하세요.",
        "가입한 뒤에도 학교 이름이 다르다면 학교 찾기에서 ‘이 학교로 전환’을 누르세요. 선택한 학교는 계정에 저장돼요."
      ],
      "links": [
        {
          "label": "구성원에게 공유할 학교 찾기",
          "href": "https://cbgpu.com/schools"
        }
      ]
    },
    {
      "title": "시간표와 급식을 연결해요",
      "body": "학교생활 연동은 운영팀이 공식 학교 정보와 제공처를 확인해 연결해요. 학교 담당자가 나이스 API 키나 학교 계정 비밀번호를 따로 만들어 전달할 필요는 없어요. 홈페이지 주소 하나만 입력했다고 모든 데이터가 자동 연결되는 것은 아니에요.",
      "steps": [
        "학교생활 기능을 선택했는지 확인하고, 학교 관리의 연동 메뉴에서 준비 상태를 확인해요.",
        "학교의 공식 홈페이지, 교육청·지역, 사용하는 시간표 서비스 이름을 운영팀에 알려 주세요.",
        "컴시간은 학교 이름과 지역이 정확히 일치해야 해요. 지원되는 학교는 공식 나이스 시간표를 사용할 수 있으며, 학과가 여러 개면 학과·과정을 직접 선택해야 해요.",
        "나이스 공개 시간표는 주간 수업 편성 자료예요. 당일 수업 변경, 담당 교사와 수업 시작 시각은 학교 안내도 함께 확인해 주세요.",
        "급식은 정확한 학교·날짜를 확인해요. 주말·휴일에 급식이 없는 것은 정상일 수 있어요. 자료가 없으면 다른 학교 급식으로 대체하지 않아요."
      ]
    },
    {
      "title": "공지·가정통신문·일정을 연결해요",
      "body": "공식 학교 사이트의 공개 자료만 사용해요. 학교별 홈페이지 구조가 달라 제공처 검토가 필요하며, 로그인 전용 게시판이나 지원하지 않는 형식은 바로 연결되지 않을 수 있어요.",
      "steps": [
        "학교 공식 홈페이지와 공지사항·가정통신문·학사일정의 각각의 목록 주소를 준비해요. 게시글 하나의 주소보다 목록 화면 주소가 좋아요.",
        "아래 문의 예시를 사용해 운영팀에 전달하세요. 학교 관리자는 준비 상태를 볼 수 있지만, 임의의 외부 사이트를 직접 승인하는 권한은 없어요.",
        "연결 후에는 학교 이름, 게시글 원문 링크, 일정의 연도·월이 실제 학교 사이트와 일치하는지 확인해요.",
        "충북과고의 EduSet 자습신청 같은 전용 기능은 다른 학교에 자동으로 적용되지 않아요. 필요한 경우 다음 단계에서 별도로 요청하세요."
      ]
    },
    {
      "title": "우리 학교 전용 기능을 요청해요",
      "body": "인증된 학교 구성원은 학교 전용 기능 요청을 보낼 수 있어요. 운영팀이 내용을 검토하고 연락해 연동·커스터마이징 범위를 조율해요. 요청 제출 즉시 기능이 만들어지는 것은 아니에요.",
      "steps": [
        "현재 학교를 선택하고 ‘학교 전용 기능 추가하기’를 누르세요. 학교 관리자라면 연동 메뉴의 연결 요청에서도 이동할 수 있어요. 위치를 못 찾겠다면 아래 디스코드·문의 버튼으로 학교 이름과 함께 요청해도 돼요.",
        "기능 제목, 해결하려는 문제, 현재 업무 순서, 원하는 결과를 적어 주세요. 예: ‘방과후실 좌석 신청을 학교 운영 시간에 맞춰 사용하고 싶어요.’",
        "학생 명단·비밀번호·인증 토큰을 본문에 넣지 마세요. 현재 요청 양식은 파일·코드 업로드 방식이 아니에요.",
        "요청 내역의 상태와 운영팀 안내를 확인하세요. 이메일 발송 처리 상태가 수신함 도착까지 보장하는 것은 아니에요."
      ],
      "links": [
        {
          "label": "디스코드로 기능 문의",
          "href": "https://discord.gg/cuqEvDDEcH", "newTab": true
        },
        {
          "label": "CBGPU 문의 화면",
          "href": "https://cbgpu.com/contact"
        }
      ]
    },
    {
      "title": "GPU가 있다면 연결해요 · 선택",
      "body": "GPU가 없는 학교는 이 단계를 건너뛰세요. 현재 서버 지원 범위는 NVIDIA 드라이버가 작동하는 Ubuntu x86_64 환경을 기준으로 해요. macOS·AMD GPU·ARM 서버는 현재 안내의 지원 범위에 포함되지 않아요.",
      "steps": [
        "실제 GPU 서버에서 학교 관리의 GPU nodes를 열고 Linux AppImage 설치 도우미를 받으세요. Windows EXE는 현재 환경 검사와 WSL2 준비 안내용이며 자동 설치 완료를 보장하지 않아요.",
        "도우미의 환경 검사를 먼저 확인해요. Jupyter에는 Docker 접근, NVIDIA Container Toolkit과 승인된 실행 이미지가 추가로 필요해요.",
        "설치 준비가 끝난 뒤 서버를 추가하고, 유효기간 10분의 개인 연결 파일을 발급받아 같은 서버의 도우미에 넣으세요. 토큰이나 연결 파일을 채팅·Git·공개 문서에 올리면 안 돼요.",
        "도우미에서 설치를 직접 시작하세요. Jupyter 설치는 별도로 선택해야 하며, 다른 제어기가 이미 관리 중인 서버를 중복 연결하지 마세요.",
        "온라인 표시는 상태 보고가 도착했다는 뜻이에요. 실행기 설치·학교 자원 권한·실행 검사까지 확인해야 예약과 Jupyter를 사용할 수 있어요.",
        "GPU 공유는 기본으로 꺼져 있어요. 서버를 연결했다는 이유로 전국 AI 공유 풀에 자동 참여하지 않아요."
      ]
    },
    {
      "title": "공개 범위와 외부 협업을 정해요",
      "body": "계정과 학교 소속, 프로젝트 소유권, 학교 자원 권한은 구분돼요. 학교를 옮기거나 졸업해도 본인 프로젝트와 공동 작업 기록이 계정 유형 변경만으로 삭제되지는 않아요.",
      "steps": [
        "학교 내부 커뮤니티·개인정보·비공개 프로젝트를 외부 공개로 바꾸지 마세요. 공개 대회·게시판은 의도한 공개 범위를 먼저 확인해요.",
        "외부 협업자에게 학교 자원이 필요하면 인증된 교내 구성원이 기간·목적·자원을 지정해 이용 요청을 보내요. 승인 전에는 접근할 수 없어요.",
        "교사·학교 관리자·GPU 관리자 역할을 업무에 맞게 나누세요. 플랫폼 전체 관리자 권한을 학교 구성원에게 공유하지 마세요."
      ]
    },
    {
      "title": "학생에게 알리기 전 마지막 점검",
      "body": "처음에는 담당자와 소수 구성원이 실제 화면을 확인한 뒤 학교에 안내하세요. 비공개 데이터를 공개하거나 실제 신청을 임의로 대량 생성하는 방식으로 시험하면 안 돼요.",
      "steps": [
        "내 계정에서 정확한 학교로 전환되고, 다른 기기에서도 같은 학교가 선택되는지 확인해요.",
        "학생·교사 가입 요청과 학생 번호가 해당 학교 구성원 목록에 표시되고, 적절한 담당자가 승인할 수 있는지 확인해요.",
        "현재 날짜의 시간표·급식과 공지 원문·학사일정의 학교·월이 맞는지 확인해요. 미연결 기능은 완료로 안내하지 마세요.",
        "다른 학교 계정이나 비로그인 상태에서 학교 내부 정보가 보이지 않는지 확인해요.",
        "모바일 화면에서도 메뉴와 신청 버튼이 잘 보이는지 확인해요. GPU를 도입했다면 허가된 시험 계정으로 예약·Jupyter까지 별도 확인해요.",
        "담당자 연락 경로를 학교 구성원에게 안내하고, 진행이 막히면 디스코드에서 지원을 받으세요."
      ]
    },
    {
      "title": "막히면 이 내용만 보내 주세요",
      "body": "디스코드에서 학교 이름과 현재 단계를 알려주면 안내를 받을 수 있어요. 화면 오류는 문구와 발생 시각을 함께 보내 주세요. 이메일 문의는 info@cbgpu.com을 사용하세요. 공개 채널의 캡처에서는 학생 이름·학번·이메일 등 개인정보를 가려 주세요.",
      "code": "학교 이름 / 지역:\n현재 단계: 학교 찾기 / 도입 신청 / 승인 후 설정 / 구성원 가입 / 학교생활 연동 / GPU\n공식 홈페이지:\n시간표 서비스 이름:\n공지사항 목록 주소:\n가정통신문 목록 주소:\n학사일정 주소:\n원하는 학교 전용 기능:\n오류 문구와 발생 시각:\n\n비밀번호·API 키·인증 토큰·GPU 연결 파일은 보내지 마세요.",
      "links": [
        {
          "label": "디스코드에서 안내받기",
          "href": "https://discord.gg/cuqEvDDEcH", "newTab": true
        },
        {
          "label": "문의 화면 열기",
          "href": "https://cbgpu.com/contact"
        }
      ]
    }
  ]
},

  {slug:'student-reverification',title:'새 학년도 학번 확인하기',description:"학년도 전환 뒤 새 학번으로 학교 소속을 다시 확인해요.",category:'school',features:['/schools/[id]/verification'],sections:[
    {title:'로그인은 계속 할 수 있어요',body:'학교에서 학년도 전환을 실행하면 일부 학생은 새 학번 확인이 필요해요. 학교 목록에서 새 학번으로 재인증하기를 누르세요. 이 과정에서 계정과 개인 프로젝트가 삭제되지는 않아요.'},
    {title:'학번 입력과 승인',body:"학교에서 안내한 새 학번을 입력하세요. 지원되는 학교의 학번 형식과 학년을 검사하고, 관리자 확인 대기 상태로 저장해요. 번호를 입력했다는 이유만으로 학교 GPU나 내부 자원 권한이 즉시 복구되지는 않아요. 잘못 입력했으면 화면의 안내에 따라 다시 확인하세요."},
    {title:'확인 전 이용 범위',body:"본인 계정과 프로젝트는 유지돼요. 학교 자원은 소속 확인이 끝날 때까지 제한될 수 있어요. 다른 학교의 학생 번호 규칙을 충북과학고 규칙으로 추측해서 처리하지 않아요."}
  ],related:['schools','school-administration']},

  {slug:'guest-school-access',title:'외부 협업자 학교 자원 이용 요청',description:"프로젝트 협업에 필요한 학교 자원을 기간과 범위를 정해 요청해요.",category:'school',features:['/schools/[id]/access'],sections:[
    {title:'인증된 학교 구성원이 요청해요',body:"학교 목록의 외부 협업자 이용 요청에서 협업자의 CBGPU 이메일, 프로젝트나 대회 이름, 이용 목적, 필요한 자원과 시작·종료 시각을 입력해요. 가입한 이메일은 협업자에게 직접 확인하세요. 비밀번호를 받거나 입력할 필요는 없어요."},
    {title:'승인 전에는 사용할 수 없어요',body:"학교 관리자가 요청을 검토해요. 본인이 요청한 권한을 스스로 승인할 수 없어요. 승인이 나더라도 허용된 기간과 자원 범위에서만 이용할 수 있고, 학교에서 조기에 회수할 수도 있어요."},
    {title:'기간이 끝나도 프로젝트는 유지돼요',body:"임시 이용 기간이 종료되면 학교 자원 접근은 차단돼요. 외부 협업자가 학생 계정으로 바뀌거나 본인 프로젝트와 공동 작업 기록이 삭제되는 것은 아니에요. 요청 화면에서 진행 상태를 확인하세요."}
  ],related:['schools','school-administration']},

  {slug:'school-messages',title:'커뮤니티와 쪽지 이용하기',description:"학교·전국·공개 게시판에서 글과 댓글을 나누고, 쪽지로 개인적으로 이야기해요.",category:'school',features:['/community','/messages'],sections:[
    {title:'이야기를 나눌 게시판 선택',body:"커뮤니티에서 우리 학교, 전국 학교, 공개 게시판을 선택해요. 학교 게시판은 인증된 같은 학교 구성원만 볼 수 있어요. 전국 게시판은 다른 학교의 인증된 구성원도 참여해요. 공개 게시판의 글은 로그인하지 않아도 읽을 수 있어요. 게시판을 선택하거나 학교를 바꾼다고 다른 공간에 글이 자동으로 공개되지는 않아요."},
    {title:'글쓰기와 댓글',body:"글쓰기를 누르고 첫 줄에 제목을, 다음 줄부터 내용을 적어요. 전체 2,000자까지 작성할 수 있고 공개 게시판에 올릴 때는 공개 범위를 확인해야 해요. 글을 열면 댓글을 읽고 등록할 수 있어요. 댓글은 원래 글의 공개 범위를 따르며 작성·댓글 참여에는 로그인이 필요해요. 전송이 실패하면 작성한 내용을 유지하므로 오류를 확인한 뒤 다시 시도하세요."},
    {title:'새 글과 검색',body:"최신 글부터 최근 100개를 보여줘요. 검색과 내 글 필터는 현재 불러온 최근 게시글에 적용돼요. 화면을 보고 있을 때 새 글을 주기적으로 확인하지만 읽던 위치를 자동으로 옮기지 않아요. 새 게시글 보기 또는 새로고침을 눌러 최신 목록을 확인할 수 있어요."},
    {title:'동의한 참여자와 쪽지',body:"쪽지 탭에서 표시할 이름을 확인하고 개인 대화 허용을 직접 켜요. 같은 학교의 인증된 참여자나 전국 게시판에서 확인할 수 있는 참여자 중 상대방도 허용한 사람만 선택할 수 있어요. 이메일·학번으로 다른 학교 명단을 검색하지 않아요. 쪽지는 공개 게시글에 표시되지 않으며 광고나 파일 첨부를 제공하지 않아요. 학교 소속·기능 정책·차단 상태가 바뀌면 이용이 제한될 수 있어요."},
    {title:'삭제·신고·숨기기',body:"본인이 쓴 글과 댓글은 삭제할 수 있고 문제가 있는 내용은 신고할 수 있어요. 글이 삭제되면 그 글의 댓글도 더 이상 열 수 없어요. 작성자를 숨기면 해당 작성자의 글·댓글과 개인 대화 연결을 제한해요. 숨긴 참여자 관리에서 직접 해제할 수 있으며 해제만으로 메시지가 전송되지는 않아요."}
  ],related:['public-discovery','schools']},

  {slug:'public-discovery',title:'로그인 없이 CBGPU 둘러보기',description:"공개된 프로젝트·대회·학교 정보를 둘러보고, 필요한 동작에서 로그인해요.",category:'start',features:['/projects','/explore/contests','/community','/explore/schools'],sections:[
    {title:'공개된 내용만 표시해요',body:"공개 탐색 기능은 단계적으로 제공돼요. 공개로 지정된 프로젝트와 대회, 공개 게시글과 학교 소개는 로그인 없이 읽을 수 있어요. 학교 내부 자료나 기존 비공개 프로젝트가 자동으로 공개되는 것은 아니에요. 공개된 항목이 없으면 빈 목록이 표시돼요."},
    {title:'참가와 작성에는 로그인이 필요해요',body:"대회 참가·팀 등록·제출·투표, 프로젝트 작성과 학교 가입을 진행하려면 해당 버튼에서 로그인하세요. 로그인 후 원래 화면으로 돌아오며, 신청이나 제출은 본인이 다시 확인한 뒤 진행해요. 로그인만으로 참가 자격이나 학교 자원 권한이 생기지는 않아요."},
    {title:'학교 내부 기능은 소속을 확인해요',body:"시간표·학교 내부 대화·GPU 예약 같은 기능은 학교별 정책을 따라요. 다른 학교의 공개 콘텐츠는 볼 수 있지만, 그 학교의 내부 자료나 비공개 프로젝트를 볼 수 있는 것은 아니에요."},
    {title:'연결이 안 되거나 내용이 없을 때',body:"일시적인 조회 오류와 공개된 항목이 없는 상태는 구분해 안내해요. 오류가 있으면 다시 조회하고, 필요한 기능은 기존 개인 메뉴에서 확인하세요. 검색 결과에 비공개 항목의 내용이나 설정이 대신 표시되지는 않아요."}
  ],related:['public-projects','schools']},
  {slug:'public-projects',title:'프로젝트 소개 공개하기',description:"본인의 프로젝트 소개를 작성하고 공개 여부를 직접 선택해요.",category:'research',features:['/publications'],sections:[
    {title:'공개 소개와 실행 환경은 달라요',body:"프로젝트 공개 화면에서는 제목·소개·본문처럼 공개할 내용을 직접 작성해요. 서버의 환경변수, 배포 설정, 비공개 저장소 주소와 파일이 자동으로 공개되지 않아요. 기존 프로젝트의 소유권과 공동 작업 권한도 바뀌지 않아요."},
    {title:'저장하고 공개하기',body:"로그인한 뒤 프로젝트 공개 관리에서 내용을 작성해요. 공개 전에는 본문에 비밀번호·토큰·개인정보나 학교 내부 자료가 없는지 확인하세요. 공개 설정을 확인한 경우에만 공개 목록에 표시돼요. 저장한 뒤 공개 목록에서 소개가 표시되는지 확인해 주세요."},
    {title:'공개를 중단할 때',body:"공개 설정을 비공개로 바꾸면 새로운 공개 조회에서 소개가 표시되지 않아요. 이미 다른 사람이 저장하거나 공유한 사본까지 회수되는 것은 아니에요. 공개 소개를 내리는 것은 원래 프로젝트나 배포 데이터를 삭제하는 작업이 아니에요."},
    {title:'졸업하거나 학교 소속이 바뀌어도',body:"프로젝트 소유권은 학교 자원 사용 권한과 별개로 유지해요. 본인 프로젝트를 확인하고 소개를 관리하는 권한과 GPU·학교 서버를 실행하는 권한은 다를 수 있어요."}
  ],related:['public-discovery','school-setup']},
  {slug:'central-cpu-allocation',title:'중앙 CPU 공용 자원·학교별 할당',description:'Review explicit shared host capacity, school allocation and project execution separately.',category:'operations',features:['/admin/central-cpu'],sections:[{title:'Explicit host and school approval',body:'The host pool starts disabled with zero capacity. A platform administrator reviews a shared CPU, memory, storage, active-project and concurrent-work budget, then separately approves each school and purpose. Values are reviewed policy limits, not automatic hardware measurements. A pool or school allocation alone does not grant a user access.'},{title:'Identity, drafts and first attachment',body:'Verified internal members, or collaborators with an independently approved current scoped grant, still need the relevant school policy and allocation. An unassigned personal project stores metadata without CPU execution or a borrowed legacy school path. Its owner may explicitly attach it once to a funded school before any execution or historical lease. Project IDs, settings and membership remain intact. Attachment does not automatically deploy. Existing legacy projects keep their existing execution path.'},{title:'Accounting, automation and revocation',body:'Usage is durable admission and lease accounting, not live physical utilization. Actual requests enforce both school and host limits, including concurrent work; stale or uncertain leases may retain capacity. Mutations require the current revision and explicit confirmation. Central Git polling starts only after separate revocable project-owner consent; routine settings saves do not enable it. Logging out does not stop an already admitted site. Removing automation consent stops future polling without stopping the current site; resource or owner permission revocation follows the separate runtime policy.'}],related:['school-administration']},
  {slug:'message-report-review',title:'쪽지·게시글 신고 검토',description:'Review reports within your current school or platform moderation authority.',category:'operations',features:['/admin/message-reports'],sections:[{title:'Scope and privacy',body:'School moderators review reports for their own school. Nationwide and direct-message reports require platform administrator permission. A direct-message report contains only the reported excerpt, never the complete private conversation. Every request checks the current account and permission; opening a management page does not grant access to member rosters or another school.'},{title:'Record an independent review',body:'Open a report, inspect its reason and reported excerpt, and enter a review note. Reports can be marked reviewing, resolved or dismissed. Changes include the exact report revision. If another reviewer changed the report, refresh and inspect the current version before submitting again; the draft note remains available. Losing review permission clears the private list and open report.'},{title:'Hide with explicit confirmation',body:'Hiding a reported message requires a separate confirmation and records the review decision. This is a soft hide from the conversation, not deletion of a conversation, account or audit history. Closing or cancelling the confirmation does not hide the message. Closed reports retain their recorded decision.'}],related:['school-messages','school-administration']},
  {slug:'ad-revenue',title:'광고 공식 보고서 확인',description:"관리자가 AdFit 공식 CSV를 검증하고 기기별 수익을 확인해요.",category:'operations',features:['/admin/ad-revenue'],sections:[{title:'공식 보고서 가져오기',body:"플랫폼 관리자만 공식 CSV의 날짜·광고 단위·수익 열과 숫자 형식을 직접 지정할 수 있어요. 미리보기의 날짜·광고 단위·수익을 확인한 뒤 가져오기를 확정해 주세요. 추정 수익과 확정 수익은 별도로 가져오며 합산하지 않아요."},{title:'지표 해석',body:"모바일·데스크톱은 실제 광고 단위 ID로 분류해요. 없는 요청·노출·클릭 수나 분모는 N/A로 표시해요. 일별·월별 표는 실제 가져온 관측 행만 표시하며 빈 날짜를 0원으로 채우거나 여러 달의 합계를 임의 배분하지 않아요. 충족률은 공식 요청 수의 의미가 확인되기 전까지 N/A예요. 공유 광고 단위로 개별 화면 수익을 추정하지 않으며 관리자 화면에는 광고가 없어요."},{title:'설정과 운영 확인',body:"가져오기 기능은 기본적으로 꺼져 있어요. 공식 콘솔의 광고 단위와 보고서 시간대를 운영자가 확인해야 해요. 기기·기간·60초 또는 120초 설정 계획을 서버 기록으로 저장하고 수정할 수 있어요. 콘솔 확인은 관리자의 직접 확인 기록이며 공급자 API 검증을 뜻하지 않아요. 기록 저장은 광고 설정이나 SDK 새로고침을 실행하지 않으며 실제 개선을 보장하지 않아요."} ],related:['school-administration']},
  {slug:'school-feature-review',title:'학교 기능 요청 검토',description:"플랫폼 관리자가 학교별 기능 요청에 답변하고 처리 상태를 기록해요.",category:'operations',features:['/admin/feature-requests'],sections:[{title:'플랫폼 운영팀의 검토',body:"플랫폼 관리자만 학교별 기능 요청 목록을 확인하고 검토할 수 있어요. 학교 운영 권한만으로 다른 학교의 요청을 처리할 수는 없어요."},{title:'답변과 상태',body:"검토 중·진행 예정·반려·제공 완료 상태와 요청자에게 공개되는 메시지를 저장해요. 검토 승인만으로 기능 코드나 권한이 자동 생성되지는 않으며, 완료 표시는 실제 제공 여부를 확인한 뒤 처리해요."},{title:'알림과 저장 결과',body:"요청과 답변은 서버에 저장돼요. 이메일 제공업체 접수는 받은편지함 전달 완료를 보장하지 않아요. 수정 버전이 충돌하면 최신 내용을 다시 확인하며, 저장 결과를 확인하지 못하면 현재 상태를 다시 불러와 확인한 뒤 저장해 주세요."}],related:['school-custom-features','school-administration']},
  {slug:'school-custom-features',title:'우리 학교 전용 기능 요청하기',description:"학교에 맞는 기능을 요청하고 검토 상태를 확인해요.",category:'school',features:['/schools/[id]/features'],sections:[
    {title:'어디에서 요청하나요?',body:"학교 소속을 확인한 뒤 학교 화면의 전용 기능 추가하기에서 요청을 작성하세요. 해결하고 싶은 일, 현재 처리 방법과 필요한 동작을 구체적으로 적으면 검토에 도움이 돼요. 비밀번호·학교 로그인 토큰이나 학생 명단은 적지 마세요."},
    {title:'접수와 이메일 알림',body:'요청을 접수하면 학교별 요청 목록에 저장되고 운영팀 알림이 대기열에 들어가요. 알림 대기 상태는 이메일 전달 완료를 뜻하지 않아요. 요청 접수도 기능 승인이나 개발 완료를 의미하지 않아요.'},
    {title:'학교별로 사용할 수 있는 기능',body:"공통 기능과 특정 학교에만 제공되는 기능은 구분돼요. 예를 들어 충북과학고의 EduSet 자습신청을 다른 학교에서 켜는 방식은 지원하지 않아요. 학교에 맞는 연결과 권한 정책을 확인한 뒤 별도 기능으로 검토해요."}
  ],related:['schools','school-administration']},
  {slug:'schools',title:'학교 찾기와 학교별 가입',description:"등록된 학교를 찾고, 승인된 학교에 소속 확인을 요청해요.",category:'start',features:['/schools'],sections:[
    {title:'사용 가능 여부',body:"학교별 가입 기능은 단계적으로 공개돼요. 아직 기능을 사용할 수 없다는 화면이 나오면 기존 CBGPU 로그인과 학교생활 기능을 그대로 이용하세요."},
    {title:'학교 선택과 소속 확인',body:"학교 이름을 검색한 뒤 지역과 공식 학교 정보를 확인하세요. 운영 승인이 완료된 학교에는 학생·교사·외부 협업자 유형으로 가입을 요청할 수 있어요. 학생 번호나 교사 정보를 입력하는 것만으로 소속이 인증되지는 않아요."},
    {title:'학교 목록과 실제 도입의 차이',body:"공식 학교 목록에 있는 학교라도 CBGPU 운영 승인이 끝난 것은 아니에요. 도입 전 학교는 학교 등록 절차로 이동해요. 학교를 선택하거나 등록 신청해도 관리자 권한이나 GPU 사용 권한이 자동으로 생기지 않아요."},
    {title:'기존 사용자',body:"기존 계정으로 계속 로그인하세요. 새 학교 소속을 요청해도 기존 계정이나 본인 프로젝트를 새로 만들 필요는 없어요."}
  ],related:['school-setup']},
  {slug:'school-setup',title:'새 학교 도입 신청',description:"학교 정보와 사용할 기능을 입력하고 운영 승인 심사를 요청해요.",category:'start',features:['/schools/new'],sections:[
    {title:'학교와 신청자 정보',body:"로그인한 뒤 학교 찾기에서 중복 학교를 먼저 확인해요. 학교 이름·위치·연락처와 학교 내 역할을 입력하세요. 학생 운영자도 신청할 수 있지만, 신청만으로 다른 구성원의 개인정보나 학교 운영 권한을 얻지는 않아요."},
    {title:'설정과 서비스 선택',body:"표시 이름, 가입 정책과 사용할 기능을 선택해요. 학교 전용 기능은 제공되는 학교에만 나타나요. GPU 서버가 없어도 신청할 수 있으며, 지금 연결·나중에 연결·서버 없음 중 실제 상황을 선택하세요."},
    {title:'저장하고 이어 하기',body:"임시 저장한 신청은 로그인한 계정의 학교 등록 화면에서 이어서 작성할 수 있어요. 다른 창에서 수정돼 저장이 충돌하면 최신 내용을 확인하세요. 오류가 나면 입력을 유지한 채 다시 저장할 수 있어요."},
    {title:'제출과 승인',body:"마지막 단계에서 정보를 검토하고 신청을 제출해요. 제출 완료는 학교 운영 승인 완료와 달라요. 승인 대기 중에는 학교 관리자 권한과 GPU 자원 접근 권한이 제공되지 않아요."}
  ],related:['school-integration','schools','school-administration']},
  {slug:'school-administration',title:'학교 등록 심사와 학교 관리',description:"플랫폼 등록 심사와 학교별 구성원·기능 관리의 권한을 구분해요.",category:'operations',features:['/admin/schools','/admin/school-applications'],sections:[
    {title:'플랫폼 학교 등록 심사',body:"플랫폼 관리자는 Schools에서 학교를 검색해 먼저 확인하고, School applications에서 등록 신청의 학교 정보, 신청자 관계와 중복 여부를 검토해요. 확인 없이 학교 운영 권한을 승인하지 마세요. 일반 사용자와 학교 관리자는 플랫폼 심사 기능을 사용할 수 없어요."},
    {title:'학교별 관리',body:"학교를 선택하면 School ID와 학교 이름이 표시되는 Overview에서 해당 학교의 구성원·설정·외부 이용·신고 관리로 이동해요. 관리 화면에서 학교를 바꿔도 개인 계정에 저장된 이용 학교는 바뀌지 않아요. 학교 관리자의 선택 목록에는 본인이 인증된 관리 권한을 가진 학교만 표시돼요. 교사라는 이유만으로 학교 관리자 권한이 생기지는 않아요. 학교 관리 권한으로 다른 학교를 관리할 수 없어요."},
    {title:'학년도 전환',body:"학교 관리의 학년도 메뉴에서 지원 여부를 확인하고 대상 학년도와 계정을 미리 봐요. 대상 학교·학년도·인원과 백업 준비를 확인한 뒤 최종 실행하세요. 대상 정보가 달라지면 다시 조회해야 하며, 같은 학교·학년도는 중복 실행할 수 없어요. 충북과학고는 1·2학년이 새 학번 확인 대기로, 3학년은 외부 소속 유형으로 바뀌어요. 다른 학교의 학번 규칙은 별도 지원 여부를 먼저 확인하세요. 개인 프로젝트와 계정은 삭제하지 않아요."},
    {title:'기능과 GPU',body:"사용할 수 있는 공통 기능과 해당 학교에 허용된 전용 기능만 설정할 수 있어요. 기능을 끄는 것은 기존 데이터를 삭제하는 작업이 아니에요. GPU 미연결은 정상 상태이며, 서버 연결만으로 외부 GPU 공유가 켜지지 않아요."}
  ],related:['schools','school-setup']},
  {slug:'contest-api',title:'외부 서비스 대회 참가 API',description:"외부 앱과 에이전트에서 본인 계정으로 대회 신청 양식을 조회하고 참가 신청·조회·취소를 처리해요.",category:'community',features:['/contests/api'],keywords:['api','zero','자동 신청','contest','외부 서비스'],sections:[
    {title:'연결 주소와 지원 범위',body:'Base URL은 https://cbgpu.com/api/ai/v1/contests 입니다. 하나의 참가 신청 URL을 요구하는 도구에는 아래 CBGPU_CONTEST_ENDPOINT를 지정하세요. 이 API는 참가자용이에요. 주최자 명의로 대회를 생성·수정하거나 다른 사람을 대신 신청·승인하는 API는 제공하지 않아요.',code:'CBGPU_CONTEST_ENDPOINT=https://cbgpu.com/api/ai/v1/contests/register'},
    {title:'대회 연동 키 만들기',body:"대회 목록의 외부 서비스 연동에서 이름, 허용할 대회와 조회·신청·취소 권한을 선택해요. 기본 30일, 최대 90일이며 대회는 최대 100개를 지정해요. 키는 한 번만 표시하고 서버에는 해시만 저장해요. 발급한 로그인 세션에 연결되므로 로그아웃·세션 회수 시에도 사용할 수 없게 돼요. 필요 없으면 같은 화면에서 폐기하세요.",links:[{label:'연동 키 발급·관리',href:'https://cbgpu.com/contests/api'}]},
    {title:'Bearer 인증',body:"발급한 cbgpu_ct_ 연동 키를 Authorization: Bearer 헤더로 보내요. 이 키는 지정한 대회와 선택한 기능만 허용해요. AI 추론용 cbgpu_ai_ 키는 사용할 수 없어요. 직접 인증을 구현하는 앱은 CBGPU access_token도 사용할 수 있으며 만료 시 기존 인증 클라이언트로 갱신해요. 연동 키 발급·조회·폐기는 로그인 access_token으로만 가능해요. 비밀번호·토큰은 공개 코드나 URL에 넣지 않아요."},
    {title:'대회와 필수 질문 먼저 확인',body:"GET /는 공개 대회를 조회해요. limit은 1–100, offset은 0–10000예요. GET /{contest_id}는 대회 상세, GET /{contest_id}/form은 참가 양식과 기간·팀 설정을 반환해요. answers의 키는 질문 ID예요. 단답·서술·선택형은 문자열, 복수 선택은 문자열 배열, 동의 항목은 불리언으로 작성해요. 필수 질문과 유효한 선택지는 웹과 같은 규칙으로 검증돼요.",code:'curl --fail-with-body "https://cbgpu.com/api/ai/v1/contests/CONTEST_UUID/form" \\\n  -H "Authorization: Bearer $CBGPU_CONTEST_TOKEN"'},
    {title:'개인 참가 신청',body:"POST /register에 contest_id와 참가 정보를 JSON으로 보내요. 특정 대회 주소 POST /{contest_id}/registrations도 지원하며 이 경우 본문에서 contest_id를 생략해요. 성공 시 201과 registration을 반환해요. status가 confirmed인지, pending 또는 waitlisted인지 반드시 확인하세요. 신청 성공이 승인 완료를 의미하지는 않아요.",code:'curl --fail-with-body "$CBGPU_CONTEST_ENDPOINT" \\\n  -H "Authorization: Bearer $CBGPU_CONTEST_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  --data \'{"contest_id":"CONTEST_UUID","attendee_name":"Your name","kind":"individual","answers":{}}\''},
    {title:'팀 참가와 개인 랜덤 배정',body:"새 팀은 kind: team_create와 team_name을, 기존 팀 합류는 kind: team_join과 UUID 형식 join_code를 보내요. 팀원마다 본인 세션으로 신청해야 하며 다른 user_id를 본문에 넣을 수 없어요. 팀전에서 개인 신청이 허용된 경우 kind: individual로 신청하면 기존 마감 후 랜덤 팀 배정에 포함돼요. 팀 인원·초대 코드·정원·승인·대기열 규칙은 웹과 동일해요.",code:'{"contest_id":"CONTEST_UUID","attendee_name":"Your name","kind":"team_create","team_name":"Our team","answers":{}}'},
    {title:'내 신청 확인·취소와 재시도',body:"GET /{contest_id}/registrations/me로 본인 신청을 확인하고, DELETE 같은 주소로 본인 신청만 취소해요. 응답을 받지 못한 신청은 먼저 GET으로 접수 여부를 확인하세요. 중복 신청은 409이며 신청 시작 전·마감 후·정원 초과도 서버에서 차단돼요. 401은 세션 확인·갱신, 403은 권한 확인, 429는 잠시 후 재시도가 필요해요. 신청 쓰기는 분당 20회, 읽기는 120회이며 로그인 인증은 계정별, 연동 키는 키별로 제한돼요. JSON 본문은 256 KiB까지예요. 브라우저 호출도 Bearer 인증을 명시하며 쿠키만으로 신청하지 않아요."},
  ],related:['contests','profile']},
  {slug:'deployment-mcp',title:'Codex · Claude Code 배포 MCP',description:"에이전트에게 설치를 맡기고 CBGPU 프론트·서버·Compose를 바로 배포해요.",category:'deploy',features:[],keywords:['mcp','codex','claude','에이전트'],sections:[
    {title:'에이전트에게 설치 맡기기',body:"먼저 아래 프롬프트를 내 컴퓨터에서 사용하는 코딩 에이전트에게 전달하세요. 배포 화면 상단에서도 같은 프롬프트를 복사할 수 있어요.",code:deploymentMcpPrompt},
    {title:'로그인',body:"Node.js 22 이상과 승인된 CBGPU 계정이 필요해요. 비밀번호는 대화형 터미널에서 직접 입력하세요. 비밀번호를 채팅·설정에 넣지 마세요. Google 전용 계정은 먼저 비밀번호 찾기로 계정 비밀번호를 설정해야 해요.",code:deploymentMcpRun+' login'},
    {title:'Codex 연결',body:"기존 설정을 보존하면서 사용자 범위 MCP를 등록해요. 등록 후 에이전트를 재시작하거나 MCP를 다시 연결하세요.",code:'codex mcp add cbgpu-deploy -- '+deploymentMcpRun},
    {title:'Claude Code 연결',body:'Windows에서 npx가 실행되지 않으면 MCP 명령을 cmd /c npx로 바꾸세요.',code:'claude mcp add --scope user cbgpu-deploy -- '+deploymentMcpRun},
    {title:'배포 요청하기',body:"로컬 변경은 먼저 GitHub에 올리세요. 프론트는 저장소·브랜치·프로젝트 폴더·빌드 설정을, 서버는 Git/Docker/Compose·실행 명령·포트·자원을 지정해요. 배포는 비동기이므로 에이전트가 상태와 로그를 확인한 뒤 실제 실행 결과를 알려줘야 해요. 서버는 기본 비공개이며 공개 도메인 사용 시 public 공개 범위도 지정해요.",code:'이 저장소 frontend/를 CBGPU에 배포해 줘. 기존 프로젝트를 확인하고 main 브랜치를 사용해. 정상 실행까지 확인한 뒤 URL을 알려 줘.'},
    {title:'권한과 연결 해제',body:"기존 프로젝트 소유자·공동작업자 권한을 그대로 적용해요. MCP는 배포 기능만 제공하고 환경변수 비밀값을 반환하지 않아요. 소유자·편집자는 set_environment로 변수를 추가·수정·삭제하거나 set_environment_from_file로 지정한 로컬 .env 파일을 가져올 수 있어요. 변수 값은 결과에 표시하지 않고 기존 값과 시스템 설정을 보존해요. CLI의 env list/set/unset도 지원해요. 변경 후 재배포해야 적용돼요. 로그인 세션은 로컬 비공개 파일에 저장·자동 갱신되며, logout은 이 MCP 세션만 종료해요.",code:deploymentMcpRun+' logout',links:[{label:'MCP 전체 문서와 소스',href:'https://github.com/CBGPU-Engineering/CBGPU-mcp'}]},
  ],related:['frontend-deployment','server-deployment']},

  {slug:'ai',title:'CBGPU AI · 전사·검색·GPU 작업',description:"학교 유휴 GPU에서 텍스트·음성·자료를 처리하고 Python 작업과 AI API를 이용해요.",category:'research',features:['/ai','/ai/chat','/ai/cli','/ai/agents'],sections:[
    {title:'홈에서 CBGPU에 물어보기',body:"학생·연구자·앱 홈의 AI 검색창에서 기능 사용법, 급식·시간표, 본인의 자습·GPU 예약·제작 신청·배포 현황과 열람 가능한 자료를 질문해요. 질문마다 관련 정보를 다시 읽고 확인 시각과 출처 화면 링크를 표시해요. 예를 들어 오늘 점심, 내 프린팅 신청 상태, 서버 배포 방법을 물을 수 있어요. 짧은 후속 질문과 AI에서 이어서 대화를 지원해요. 조회 오류나 오래된 자료라는 안내가 보이면 출처 화면에서 최신 내용을 확인해 주세요. 급식과 학교 소식은 원본 서비스의 캐시 주기가 있고, 검색 결과는 최근 기록·발췌로 한정돼요."},
    {title:'통합 AI',body:"CBGPU AI는 /ai에서 이용해요. 같은 사이드바에서 대화, 프롬프트 최적화, 음성 전사, 자료 검색, GPU 작업, API와 CLI 안내를 선택해요. 학생·연구자 홈과 앱 하단 AI 버튼에서 바로 열 수 있어요. 왼쪽 목록에서 새 대화, 검색, 이름 변경과 삭제를 할 수 있고 휴대폰에서는 왼쪽 위 버튼으로 목록을 열어요. 대화는 내 계정에 저장되므로 다른 기기에서도 이어갈 수 있어요. 글·코드 답변을 복사하고 생성을 중지할 수 있어요. 데스크톱은 Enter로 전송하고 Shift+Enter로 줄을 바꾸며, 휴대폰에서는 전송 버튼을 눌러요. 긴 대화는 최근 메시지 중심으로 답해요. 답변은 생성되는 대로 실시간 표시돼요. 웹 검색을 켜면 질문을 검색엔진에 보내 공개 자료와 출처를 함께 참고해요. 전사·자료 검색은 같은 AI 사이드바에서 선택하세요."},
    {title:'어디서 사용하나요?',body:"전체 서비스 → CBGPU AI에서 텍스트·음성 전사·자료 검색·GPU 작업·개발 API를 선택해요. 연구노트, 논문 초록, 공유자료 상세, 배포 로그에도 AI 버튼이 있어요. 자료는 외부 AI API에 보내지 않고 CBGPU 서버에서 처리해요."},
    {title:'GPU 예약 우선',body:"공용 작업은 현재 예약 및 5분 이내 시작할 예약을 제외하고, 사용자 GPU 프로세스가 없는 GPU 한 개에서 순차 실행해요. 예약·사용자 프로세스가 확인되거나 예약 정보를 읽지 못하면 공용 작업을 중단하고 재대기해요. 검사 간격과 종료 시간 동안 짧은 지연이 있을 수 있어요. 학생 Jupyter 컨테이너를 초기화하거나 중단하지 않아요."},
    {title:'파일 첨부·OCR·음성 전사',body:"AI 대화에서는 PDF·이미지·CSV·텍스트를 파일당 8MB, 최대 3개 첨부해요. 파일 선택 직후 업로드·문서 읽기·준비 완료 상태를 확인하고, 내용 확인으로 인식 텍스트를 열 수 있어요. 이미지 붙여넣기와 파일 끌어놓기도 지원해요. 글자가 흐리거나 일부만 읽은 경우 표시해요. 음성 또는 동영상 파일(최대 200 MB)을 선택하면 텍스트와 SRT 자막을 받아요. 전사 진행은 저장되며 중단 후 이어서 처리해요. 공유자료 상세의 AI 요약은 PDF·텍스트를 지원하며 스캔 PDF와 PNG·JPEG·WebP·TIFF 이미지는 이 서버에서 한국어·영어 OCR로 글자를 읽어요. 긴 문서는 앞 100페이지의 추출 텍스트 중 모델 문맥 길이 안에서 처리하며, 일부만 읽었을 때 표시해요. 결과는 원문과 확인한 뒤 복사·다운로드하거나 비공개 연구노트로 저장하세요."},
    {title:'의미로 자료 검색',body:"본인이 열람할 수 있는 연구노트 본문, 공유자료와 공개 논문의 제목·태그·추출 가능한 파일 본문, 사용 문서를 검색해요. 준비가 끝난 공유 PDF·텍스트와 게시된 논문을 주기적으로 읽어 본문을 색인해요. 이미지 전용 PDF는 본문을 추출하지 못해 제목·메타데이터만 검색돼요. 파일당 앞 100페이지와 최대 20만 글자를 처리해요. 최근 노트·자료·논문을 합쳐 최대 500개 후보를 의미와 키워드로 정렬하며, 결과를 조회할 때 현재 열람 권한을 다시 확인해요. 비공개 노트는 소유자만 검색해요."},
    {title:'Python GPU 작업',body:"Python 코드를 입력하거나 ZIP(업로드 200 MB, 압축 해제 후 2 GB, 최대 10,000파일)을 올리고 실행 파일을 선택해요. 실행 환경과 자원 한도는 GPU 작업 화면의 현재 안내를 확인해 주세요. 인터넷 연결 없이 실행해요. 작업 폴더 /workspace는 중단 후에도 유지해요. /workspace/output에 결과를 쓰면 다운로드할 수 있어요. 학습을 이어가려면 체크포인트를 저장하고 재실행 시 읽도록 코드를 작성하세요. 대기열 예제에 SIGTERM 처리와 체크포인트가 있어요. 누적 실행 시간은 1–120분이에요."},
    {title:'프롬프트 최적화',body:"AI 사이드바의 프롬프트 최적화를 선택하고 초안을 입력하세요. 목적·맥락·출력 형식·제약·검증 기준을 정리한 개선안을 만들어요. 제공하지 않은 정보는 자리표시자로 남기며 원래 의도를 바꾸지 않도록 요청해요. 결과를 복사하거나 대화 입력창으로 가져올 수 있고, 작성 중인 입력이 있으면 교체 전에 확인해요. 최적화 결과도 내 작업에서 다시 열 수 있어요."},
    {title:'개인 에이전트',body:'AI → 개인 에이전트에서 OpenClaw나 Hermes 설치 도우미를 받거나 Linux 서버용 설치 프롬프트를 만들어요. 웹에서 입력한 API 키와 Telegram 봇 토큰은 비밀 설정 파일로 내려받아요.'},
    {title:'CLI 코딩 에이전트',body:"AI → CLI 코딩 도구에서 설치해요. Node.js 22 이상에서 npm install -g github:CBGPU-Engineering/OpenCode-for-CBGPU 를 실행하고, 웹에서 만든 API 키로 cbgpu login 후 프로젝트 폴더에서 cbgpu 를 실행하세요. OpenCode 기반 에이전트이며 기본 Coder 모델, Chat, Pro, GPT-OSS 모델을 고를 수 있어요. 코드와 도구 결과는 추론을 위해 학교 서버에 전송되지만 파일 수정과 셸 명령은 자신의 컴퓨터에서 승인 후 실행돼요. 외부 유료 모델로 자동 전환하지 않아요. cbgpu logout은 로컬 키를 지우며 서버 키 폐기는 API 화면에서 해요."},
    {title:'Robotics · 로봇 연결',body:"AI 사이드바의 Robotics에서 가상 로봇의 계획을 체험하고 운영체제별 설치 명령과 통합 프롬프트를 복사해요. 운영체제별 안내에서 현재 SDK 설치 명령을 확인해 주세요. 다른 언어와 OS는 HTTPS API로 연결해요. API 키를 로봇 컴퓨터 환경변수에 보관하고 cbgpu-robotics plan 명령으로 계획을 만들어요. 기본은 모의 실행이며 실제 동작에는 기존 드라이버를 연결한 로컬 어댑터, 현장 검증, 로컬 활성화·승인이 필요해요. POST /v1/robotics/plans로 비동기 계획을 만들고 GET /v1/robotics/plans/{id}로 확인해요. 비상정지·장애물 회피·센서 최신성은 로봇 내부에서 검사하며 최대 6단계·60초, 관측 후 120초 이내 계획만 허용해요. 현재는 텍스트와 구조화 센서 정보 기반이며 카메라 영상을 직접 이해하는 모델은 포함하지 않아요. 계획 체험은 가상 로봇이에요. 실제 기기는 원격 지도에서 등록하고 라즈의 cbgpu-robotics connect 숨김 입력으로 연결해요. agent를 켜 두면 생성 중인 SLAM 지도·위치와 선택적 JPEG 미리보기가 표시돼요. 원격 제어를 시작한 후 알려진 빈 공간을 찍어 목표를 보내며, 실제 이동에는 라즈베리파이의 로컬 검증·활성화와 --allow-navigation이 필요해요. 상단 정지 버튼으로 내비게이션을 취소할 수 있으나 네트워크 정지는 현장 비상정지를 대신하지 않아요. 라즈5·LiDAR·Arduino 시리얼·엔코더 없음·사전 지도 없음 차량용 통합 프롬프트도 제공하며, 온라인 SLAM과 로컬 지도 클릭 이동을 기존 로봇 프로젝트에 연결하도록 안내해요."},
    {title:'모델 선택',body:"Chat은 Qwen2.5 7B 일반 대화, Coder는 Qwen2.5 Coder 7B 코딩·도구 제안, Pro는 Qwen2.5 14B 글쓰기·분석, GPT-OSS는 OpenAI GPT-OSS 20B 추론 모델이에요. 대화창 위 모델 메뉴와 AI 텍스트 도구에서 선택해요. 입력창 하단의 답변 검토 수준 버튼을 누르면 슬라이더로 빠르게·균형·깊게를 조절할 수 있어요. API의 모델 ID는 cbgpu-chat, cbgpu-coder, cbgpu-pro, cbgpu-oss이며 /v1/models에서 준비 상태를 확인해요. 텍스트 모델의 컨텍스트는 8,192토큰, 출력은 Qwen 최대 2,048토큰, GPT-OSS 최대 4,096토큰이며 긴 대화는 최근 내용을 중심으로 처리해요."},
    {title:'AI API',body:"개발 API에서 키를 만들면 한 번만 표시해요. 서버 환경변수에 보관하고 필요 없으면 폐기하세요. Base URL은 https://cbgpu.com/api/ai/v1 입니다. cbgpu-chat은 /chat/completions, cbgpu-embeddings는 /embeddings, cbgpu-whisper는 /audio/transcriptions를 사용해요. stream: true의 SSE 전송과 함수 도구 제안을 지원해요. 대기 중에는 연결 유지 메시지를 보내고, 답변 생성이 시작되면 실제 생성 내용을 실시간 전달해요. reasoning_effort는 low, medium, high를 지원하며 GPT-OSS는 모델 고유의 추론 수준을, Qwen high는 초안 검토를 적용해요. 도구는 API 서버에서 실행되지 않고 호출한 클라이언트가 승인·실행해요. GPU가 계속 바쁘면 대기 시간 초과 또는 503 응답을 받을 수 있어요. API 키로 웹의 비공개 작업 기록이나 코드 실행 권한을 관리할 수 없어요. API로 만든 결과는 같은 계정의 내 작업에서 확인해요."},
    {title:'웹 검색과 공개 페이지 읽기',body:"웹 검색은 새 대화에서 기본으로 켜져요. 입력창의 버튼으로 끄거나 다시 켤 수 있어요. 켜져 있으면 질문을 DuckDuckGo에 전송하고 공개 웹 자료를 참고해 출처 링크와 함께 답해요. CLI에서도 승인한 web_search, read_web_page 도구를 쓸 수 있어요. 로그인이나 사설 네트워크가 필요한 페이지는 읽지 않으며, 웹 내용은 검증이 필요한 참고 자료예요."},
    {title:'개인정보·보관·취소',body:"작업과 결과는 본인만 열람해요. 완료한 작업·결과는 30일, 업로드 원본은 14일 보관하며 실행·대기 중인 작업 파일은 유지해요. 작업 삭제는 실행 중단 후 입력·결과·원본을 정리해요. 계정당 활성 작업은 5개, API 키는 5개, 업로드 원본 합계는 2GB까지예요. 예약이 많을 때는 오래 대기할 수 있고, 내 작업에서 취소·재실행·삭제할 수 있어요. AI 답변을 연구노트나 공개 게시물로 자동 저장·게시하지는 않아요."}
  ],related:['gpu-notebook','materials','notes']},
  {
    "slug": "getting-started",
    "title": "처음 시작하기",
    "description": "처음 이용할 때 필요한 로그인, 기능 찾기와 작업 공간 안내예요.",
    "category": "start",
    "features": [
      "/",
      "/workspace",
      "https://student.cbgpu.com",
      "https://researcher.cbgpu.com",
      "https://developer.cbgpu.com"
    ],
    "sections": [
      {
        "title": "홈에서 시작하기",
        "body": "메인은 학교생활 공간으로 시작해요. 버전을 먼저 고를 필요 없이 자습 신청, 시간표, 급식, 기상송, 자료 공유를 찾을 수 있어요.",
        "links": [
          {
            "label": "CBGPU 메인",
            "href": "https://cbgpu.com"
          }
        ]
      },
      {
        "title": "필요한 기능 찾기",
        "body": "홈의 “무엇이 필요한가요?” 아래에서 기능을 눌러요. 즐겨찾기에 없는 기능도 분류별 목록에 모두 표시돼요. 검색창에는 “밥”, “자료”, “프린터”처럼 알고 있는 단어를 입력해 보세요.",
        "steps": [
          "목록에서 기능을 고르거나 검색어를 입력해요.",
          "결과가 없으면 검색과 분류를 초기화해요.",
          "로그인이 필요한 기능은 CBGPU 계정으로 로그인한 뒤 이용해요."
        ]
      },
      {
        "title": "학교생활과 연구·개발",
        "body": "학교생활은 자습·수업·급식·학교 활동 중심이에요. GPU, 웹사이트·서버 배포, 논문 작성과 제작은 연구·개발 공간에 모여 있어요. 개발자용과 리서처용 공간은 통합되었으며 기존 developer.cbgpu.com 주소도 같은 통합 화면을 제공해요.",
        "links": [
          {
            "label": "연구·개발 공간",
            "href": "https://researcher.cbgpu.com"
          }
        ]
      },
      {
        "title": "내 이름과 상태 확인",
        "body": "오른쪽 위 프로필에서 계정 정보를 확인해요. 이름·학번 확인이 필요한 계정은 프로필을 수정하고 관리자에게 확인을 요청하세요. 다른 공간으로 이동할 때도 같은 CBGPU 계정을 사용해요."
      }
    ],
    "related": [
      "account",
      "feature-search",
      "app"
    ]
  },
  {
    "slug": "feature-search",
    "title": "기능 찾기·즐겨찾기",
    "description": "검색, 분류, 최근 사용과 즐겨찾기를 이용해 원하는 기능으로 이동하기.",
    "category": "start",
    "features": [
      "/services"
    ],
    "sections": [
      {
        "title": "기능 이름을 몰라도 검색",
        "body": "홈 검색 또는 전체 기능에서 서비스 이름, 설명과 관련 단어를 검색해요. “자료공유”처럼 띄어쓰기 없이 입력할 수도 있어요. 다른 공간에만 있는 기능은 “다른 공간에서 찾았어요”에 표시돼요.",
        "links": [
          {
            "label": "전체 기능 열기",
            "href": "https://cbgpu.com/services"
          }
        ]
      },
      {
        "title": "분류와 검색 함께 쓰기",
        "body": "학교생활, GPU 사용, 웹사이트·서버 배포 같은 분류 버튼으로 목록을 좁혀요. 전체를 누르면 현재 공간의 모든 분류를 다시 볼 수 있어요. 결과가 없으면 검색어 지우기 또는 검색과 분류 초기화를 사용하세요."
      },
      {
        "title": "키보드로 빠르게 열기",
        "body": "상단 돋보기 또는 Ctrl+K(macOS는 Command+K)로 기능 찾기를 열어요. 검색 후 위·아래 방향키로 결과를 고르고 Enter로 이동해요. Escape나 닫기를 누르면 검색창이 닫혀요."
      },
      {
        "title": "즐겨찾기와 최근 사용",
        "body": "홈의 즐겨찾기에서 편집을 누르면 현재 공간의 기능을 최대 8개 선택할 수 있어요. 최근 사용은 방문한 기능을 보여줘요. 이 설정은 계정·공간별로 현재 브라우저에 저장되므로 다른 기기와 자동으로 같아지지는 않아요. 브라우저 데이터를 지우면 초기화될 수 있어요."
      }
    ],
    "related": [
      "getting-started",
      "app"
    ]
  },
  {
    "slug": "account",
    "title": "계정 만들기·로그인·비밀번호 찾기",
    "description": "회원가입부터 로그인 연결과 재설정 이메일 오류까지.",
    "category": "start",
    "features": [
      "/auth/signup",
      "/auth/login",
      "/auth/forgot-password",
      "/auth/reset-password",
      "/auth/callback",
      "/auth/transfer"
    ],
    "sections": [
      {
        "title": "회원가입",
        "body": "회원가입 화면의 필수 정보를 입력해요. 본인 이메일과 정확한 이름·학번을 사용하세요. 가입 후 화면에 표시되는 이메일 확인 또는 계정 확인 안내를 따라 완료해요.",
        "links": [
          {
            "label": "회원가입",
            "href": "https://cbgpu.com/auth/signup"
          }
        ]
      },
      {
        "title": "로그인과 공간 이동",
        "body": "기존 CBGPU 이메일·비밀번호로 로그인해요. 학교생활과 연구·개발은 같은 계정을 사용하며 공간 이동 링크가 로그인을 연결해요. 주소를 직접 열었을 때 로그인 화면이 나오면 같은 계정으로 다시 로그인하세요.",
        "links": [
          {
            "label": "로그인",
            "href": "https://cbgpu.com/auth/login"
          }
        ]
      },
      {
        "title": "비밀번호 재설정",
        "body": "로그인 화면의 비밀번호 찾기를 이용해요.",
        "steps": [
          "가입한 이메일 주소를 입력하고 재설정 메일을 요청해요.",
          "받은 이메일에서 재설정 링크를 열어요.",
          "새 비밀번호를 저장하고 다시 로그인해요."
        ],
        "links": [
          {
            "label": "비밀번호 찾기",
            "href": "https://cbgpu.com/auth/forgot-password"
          }
        ]
      },
      {
        "title": "메일이나 링크가 작동하지 않을 때",
        "body": "스팸함, 입력한 주소와 가장 최근 메일을 확인하세요. 만료되거나 이미 사용한 링크는 새로 요청해요. “Error sending recovery email”이 표시되면 요청이 성공한 것이 아니므로 계속 반복하지 말고 오류 문구와 발생 시각을 문의에 남겨주세요. 비밀번호나 재설정 링크 전체는 보내지 마세요."
      }
    ],
    "related": [
      "profile",
      "troubleshooting",
      "contact"
    ]
  },
  {
    "slug": "profile",
    "title": "프로필·SSH 공개키·알림 설정",
    "description": "이름과 학번 수정, 비밀번호 변경, 공개키 등록, 알림과 계정 삭제.",
    "category": "start",
    "features": [
      "/profile"
    ],
    "sections": [
      {
        "title": "이름·학번·사진",
        "body": "프로필에서 본인의 정보를 확인하고 이름·학번을 수정한 뒤 저장해요. 사진 변경 기능으로 프로필 이미지를 설정할 수 있어요. 학번이나 이름 확인이 필요한 경우 수정만으로 즉시 권한이 복구된다고 보장되지는 않아요.",
        "links": [
          {
            "label": "내 프로필",
            "href": "https://cbgpu.com/profile"
          }
        ]
      },
      {
        "title": "비밀번호 변경",
        "body": "비밀번호 변경 영역에서 현재 비밀번호와 새 비밀번호·확인 값을 입력하고 저장해요. 현재 비밀번호를 모르면 비밀번호 찾기를 이용하세요."
      },
      {
        "title": "SSH 공개키 등록",
        "body": "개인 컴퓨터에서 준비한 ssh-ed25519 또는 지원되는 형식의 공개키 한 줄을 SSH 공개키에 붙여넣고 저장해요. .pub 파일 내용만 등록하고 비공개키는 올리지 않아요.",
        "links": [
          {
            "label": "SSH 안내",
            "href": "https://docs.cbgpu.com/ssh"
          }
        ]
      },
      {
        "title": "앱 알림 설정",
        "body": "프로필의 알림 항목에서 본인에게 제공되는 항목을 켜거나 꺼요. Android 앱 로그인과 휴대폰의 알림 허용도 필요해요. 담당자·관리자 전용 항목은 역할에 따라 보이며 설정을 켰다는 이유만으로 그 역할을 얻는 것은 아니에요."
      },
      {
        "title": "계정 삭제",
        "body": "계정 삭제는 확인 절차를 거쳐 진행해요. 필요한 자료와 프로젝트 결과를 먼저 보관하고 화면에서 영향을 확인한 뒤 실행하세요. 단순 로그아웃을 원할 때는 계정 삭제 대신 로그아웃을 사용해요."
      }
    ],
    "related": [
      "account",
      "ssh",
      "app"
    ]
  },
  {
    "slug": "app",
    "title": "모바일 웹·Android 앱",
    "description": "앱 설치, 학교생활·연구개발 전환, 알림 권한과 업데이트.",
    "category": "start",
    "features": [
      "/download",
      "https://app.cbgpu.com"
    ],
    "sections": [
      {
        "title": "모바일 웹으로 이용",
        "body": "app.cbgpu.com은 휴대폰에 맞춘 화면이에요. 위 가운데에서 학교생활과 연구·개발을 바꾸고, 하단의 홈·주요 기능·전체 기능·내 정보로 이동해요. 앱에서는 같은 모바일 화면에서 일반 기능을 계속 이용해요. Docs와 arXiv 같은 독립 서비스는 별도 주소로 열려요.",
        "links": [
          {
            "label": "모바일 버전",
            "href": "https://app.cbgpu.com"
          }
        ]
      },
      {
        "title": "Android 설치·업데이트",
        "body": "공식 다운로드 페이지에서 APK와 설치 안내를 확인해요. 기기가 요청하는 경우 해당 브라우저의 설치 권한을 허용해요. 이미 설치한 앱은 공식 업데이트 APK로 갱신하세요.",
        "links": [
          {
            "label": "공식 다운로드",
            "href": "https://cbgpu.com/download"
          }
        ]
      },
      {
        "title": "알림이 오지 않을 때",
        "body": "앱에 CBGPU 계정으로 로그인하고 Android 알림 권한과 프로필의 해당 알림 설정을 확인하세요. 담당자 알림은 역할과 담당 장비·지정 담당자에 따라 대상이 정해져요. 등록된 기기가 없거나 알림 권한이 꺼져 있으면 휴대폰에서 받을 수 없어요."
      },
      {
        "title": "화면이 예전과 다를 때",
        "body": "화면을 새로고침하거나 앱을 완전히 닫았다가 다시 열어요. 로그인 상태와 앱 버전도 확인하세요. 계속 안 되면 해당 기능 주소, 앱 버전과 화면 사진을 문의에 첨부해 주세요."
      }
    ],
    "related": [
      "profile",
      "feature-search",
      "troubleshooting"
    ]
  },
  {
    "slug": "study",
    "title": "자습 신청·좌석 현황",
    "description": "자습실·교시·좌석 확인, EduSet 학생 계정 연결과 공식 신청·취소.",
    "category": "school",
    "features": [
      "/study",
      "/study/link"
    ],
    "sections": [
      {
        "title": "자습 현황 보기",
        "body": "자리 둘러보기에서 교시를 선택하고 자습실로 찾기 또는 학생으로 찾기를 사용해요. 교실은 기본 이름순으로 표시되며 빈자리 수를 바로 확인할 수 있어요. 빈자리 있는 교실만 필터와 빈자리 많은 순 정렬로 범위를 좁힐 수 있어요. 정원제 교실은 좌석 수를 알 수 없어 빈자리 필터에서 제외돼요.",
        "links": [
          {
            "label": "자습 신청 열기",
            "href": "https://cbgpu.com/study"
          }
        ]
      },
      {
        "title": "교시·좌석 선택",
        "body": "자습실을 열고 교시를 고른 뒤 배치도 또는 목록을 사용해요. 좌석을 누르면 신청자와 승인 대기 상태를 확인할 수 있고, 빈자리의 이 자리 신청하기로 신청서를 채울 수 있어요. 조회와 신청 창에서 같은 실제 좌석 배치를 사용해요. 빈자리는 초록 테두리, 선택한 자리는 기본 강조색, 신청된 자리는 회색으로 구분하며 텍스트 상태도 함께 표시해요. 확대·축소 또는 목록 검색을 사용할 수 있고, 배치도가 화면보다 크면 해당 영역 안에서 가로·세로로 스크롤하세요. 신청 창 하단에서 선택 내용과 신청 버튼을 확인해요."
      },
      {
        "title": "실제 신청하기",
        "body": "앱 v1.0.7 이상에서 EduSet 계정 연결 → EduSet 로그인을 눌러요. 공식 학교 로그인 창에서 로그인하면 자동으로 CBGPU로 돌아오며, 본인 학생 정보를 확인해 한 번 연결하면 돼요. 연결은 같은 CBGPU 계정의 앱·웹에서 유지돼요. 기존 앱은 업데이트 없이 최초 연결 도우미를 사용할 수도 있어요. 공식 신청 시간에 신청할 교시를 여러 개 고르고 교실·자리·선생님을 선택한 뒤 신청하기를 눌러요. 교시는 1·2·3교시 순서로 표시하며, 마지막 교실·자리·선생님·사유는 같은 기기에 기억해요. 정원제 교실은 좌석을 선택하지 않아요. 성공 후 공식 내역을 다시 조회하며 승인 대기·승인·거절 상태를 그대로 표시해요. 신청이 완료되기 전에는 좌석이 확보된 것이 아니에요."
      },
      {
        "title": "평일 자동신청",
        "body": "내 자습 신청 → 자동신청 설정에서 07:30–15:30의 실행 시각, 교시, 교실, 기본 자리, 선생님과 사유를 저장하고 자동신청 사용을 켜요. 월요일부터 금요일까지만 서버에서 실행하므로 앱을 켜둘 필요가 없어요. 이미 지난 시각은 다음 평일부터 시작해요. 기본 자리가 비어 있으면 그 자리를, 사용 중이면 같은 교실 배치도에서 가장 가까운 빈자리를 신청해요. 이미 신청한 교시는 변경하지 않아요. 공식 접수가 닫혀 있으면 15:30까지 기다리며 학교 휴일·접수 정책·계정 연결 만료에 따라 실행되지 않을 수 있어요. 최근 실행 결과에서 확인하세요. 결과가 불확실하면 중복 요청 없이 기록을 남겨요. 자동신청 끄기는 기존 신청을 취소하지 않으며, EduSet 연결 해제 시 자동신청도 꺼져요."
      },
      {
        "title": "변경·취소와 계정 연결",
        "body": "내 자습 신청에서 본인의 신청을 취소할 수 있어요. 교실·좌석 변경은 기존 신청 취소 후 재신청으로 진행해요. 신청과 취소는 공식 접수 시간에만 허용돼요. EduSet 비밀번호는 CBGPU에서 입력받지 않고, 학교 세션은 서버에 암호화해 CBGPU 계정별로 저장해요. 연결 해제로 삭제할 수 있으며, 공식 학교 세션이 만료되면 다시 로그인해야 해요. 학교 보안 확인이 연결을 거절하면 공식 사이트를 이용하세요. 응답 오류가 나면 재신청하기 전에 내 신청 새로고침으로 실제 등록 여부부터 확인해요."
      },
      {
        "title": "조회 실패·알림·연결 기여",
        "body": "일부 방 조회가 실패하면 다시 불러오기를 사용하세요. 한 교실의 배치 조회가 실패해도 나머지 교실은 계속 표시하며, 해당 교실을 열어 확인된 신청자 목록을 볼 수 있어요. 배치나 신청 내역이 불완전하면 빈자리로 표시하거나 그 화면에서 신청하지 않아요. 화면이 보이는 동안 30초마다 다시 조회하고, 마지막 조회 시각과 갱신 오류를 표시해요. 토큰이나 조회 연결이 만료되면 연결 기여 안내를 확인해요. 자습 알림은 화면의 알림 설정과 앱·브라우저 권한을 함께 확인하세요.",
        "links": [
          {
            "label": "조회 연결 기여",
            "href": "https://cbgpu.com/study/contribute"
          }
        ]
      }
    ],
    "related": [
      "study-contribute",
      "app",
      "troubleshooting"
    ],
    "keywords": [
      "eduset",
      "edu-set",
      "자습신청",
      "좌석"
    ]
  },
  {
    "slug": "study-contribute",
    "title": "자습 조회 연결 기여",
    "description": "브라우저 스크립트로 학교 자습 조회 연결을 갱신하는 방법.",
    "category": "school",
    "features": [
      "/study/contribute"
    ],
    "sections": [
      {
        "title": "언제 필요한가요?",
        "body": "조회 연결 갱신을 돕고 싶은 승인된 사용자를 위한 기능이에요. 일반적인 좌석 조회만 하려면 먼저 자습 신청 화면을 이용하세요.",
        "links": [
          {
            "label": "연결 기여 화면",
            "href": "https://cbgpu.com/study/contribute"
          }
        ]
      },
      {
        "title": "화면의 세 단계 따라 하기",
        "body": "현재 안내는 Chrome·Brave·Edge와 Violentmonkey 사용자 스크립트 방식을 사용해요. 화면의 공식 설치 링크와 안내를 순서대로 따르세요.",
        "steps": [
          "안내된 브라우저에서 Violentmonkey를 설치하고 필요한 실행 설정을 확인해요.",
          "CBGPU 스크립트 설치를 눌러 사용자 스크립트를 설치해요.",
          "연결 버튼으로 기기를 등록하고 열린 학교 사이트에서 본인 계정으로 로그인해요."
        ]
      },
      {
        "title": "연결 상태 확인",
        "body": "연결 화면에서 기기 목록과 최근 갱신 시각을 확인해요. 설치만 하고 연결 등록이나 학교 로그인을 끝내지 않으면 갱신이 완료되지 않을 수 있어요."
      },
      {
        "title": "다른 브라우저·연결 해제",
        "body": "다른 브라우저도 연결하기로 추가하고, 더 이상 쓰지 않는 기기는 목록에서 연결 해제해요. 학교 로그인 정보와 조회 토큰은 공개 게시판이나 문의 메시지에 붙여넣지 마세요."
      }
    ],
    "related": [
      "study",
      "troubleshooting"
    ]
  },
  {
    "slug": "timetable",
    "title": "시간표",
    "description": "학년·반 선택, 이번 주 수업과 개인 시간표 편집.",
    "category": "school",
    "features": [
      "/timetable"
    ],
    "sections": [
      {
        "title": "내 학년·반 선택",
        "body": "시간표에서 학년과 반을 선택해요. 프로필의 학번이 올바른지도 확인하세요. 화면에 표시되는 오늘 수업과 주간 표를 함께 볼 수 있어요.",
        "links": [
          {
            "label": "시간표 열기",
            "href": "https://cbgpu.com/timetable"
          }
        ]
      },
      {
        "title": "변경된 수업 확인",
        "body": "대체 수업이나 최근 변경이 의심되면 새로고침을 눌러요. 제공처 조회가 실패하면 같은 주의 마지막 정상 시간표를 최대 48시간까지 표시하며, 마지막 확인 시각과 대강 미반영 가능성을 안내해요. 화면을 열어두면 자동으로 다시 확인해요. 지난주 자료는 이번 주 시간표로 대신 표시하지 않아요. 외부 시간표 제공처의 갱신 시점에 따라 실제 학교 안내와 차이가 날 수 있으므로 중요한 변경은 학교 공지도 확인하세요."
      },
      {
        "title": "편집·저장",
        "body": "개인 시간표 편집이 제공되는 경우 편집을 눌러 과목을 수정하고 저장해요. 취소를 누르면 수정 내용을 저장하지 않고 돌아가요. 개인 표 변경과 학교 전체 시간표 수정은 달라요."
      },
      {
        "title": "설정 필요·빈 표",
        "body": "학년·반을 확인해 다시 불러와 주세요. DB 설정 필요 안내가 계속되면 오류 문구를 관리자에게 알려 주세요. 계속 비어 있으면 날짜·학년·반과 오류 문구를 관리자에게 전달하세요."
      }
    ],
    "related": [
      "profile",
      "feed"
    ]
  },
  {
    "slug": "meal",
    "title": "급식",
    "description": "날짜별 아침·점심·저녁 식단 확인.",
    "category": "school",
    "features": [
      "/meal"
    ],
    "sections": [
      {
        "title": "오늘 식단 보기",
        "body": "급식에서 날짜를 확인하고 제공된 식단 카드를 읽어요. 식사가 없는 날에는 해당 식단이 표시되지 않을 수 있어요.",
        "links": [
          {
            "label": "급식 열기",
            "href": "https://cbgpu.com/meal"
          }
        ]
      },
      {
        "title": "다른 날짜 확인",
        "body": "화면의 날짜 이동·선택 기능으로 원하는 날의 메뉴를 확인해요. 식사 종류별로 카드가 나뉘어 있으므로 점심과 저녁을 구분해 보세요."
      },
      {
        "title": "표시 정보 읽기",
        "body": "메뉴와 함께 제공되는 영양·알레르기 관련 정보는 해당 화면의 원문 표시를 확인하세요. 개인 알레르기나 섭취 가능 여부는 식단 제목만으로 판단하지 말고 학교 급식 담당자에게 확인해요."
      },
      {
        "title": "메뉴가 없거나 늦게 보일 때",
        "body": "해당 날짜가 급식 운영일인지 확인하고 다시 불러와요. 외부 급식 자료가 늦게 갱신될 수 있으며 학교 현장 안내와 다르면 학교 안내를 우선 확인하세요."
      }
    ],
    "related": [
      "getting-started",
      "feed"
    ]
  },
  {
    "slug": "wakeup",
    "title": "기상송 신청",
    "description": "기숙사·날짜별 대기열 확인, Spotify 곡 선택과 내 신청 삭제.",
    "category": "school",
    "features": [
      "/wakeup"
    ],
    "sections": [
      {
        "title": "기숙사와 날짜",
        "body": "기상송에서 기숙사를 선택하고 신청할 날짜의 대기열을 확인해요. 다른 기숙사나 날짜에 신청하지 않도록 제출 전에 다시 확인하세요.",
        "links": [
          {
            "label": "기상송 열기",
            "href": "https://cbgpu.com/wakeup"
          }
        ]
      },
      {
        "title": "노래 검색·신청",
        "body": "Spotify 검색에 곡명이나 가수를 입력하고 검색 결과에서 원하는 곡을 선택해요. 선택한 곡을 확인하고 날짜와 메모(선택)를 입력한 뒤 신청해요. 한마디는 최대 80자예요."
      },
      {
        "title": "내 신청 확인·취소",
        "body": "내 신청 내역에서 곡과 날짜를 확인하고 필요한 경우 해당 신청 삭제 버튼을 사용해요. 대기열에 들어갔다는 사실이 실제 재생 순서나 재생 완료를 보장하지는 않아요."
      },
      {
        "title": "검색·대기열 오류",
        "body": "검색이 실패하면 짧은 제목·가수명으로 다시 시도하세요. 음악 제공처나 운영 설정 문제로 계속 실패하면 기숙사, 날짜, 검색어와 오류 문구를 문의에 남겨요."
      }
    ],
    "related": [
      "contact",
      "troubleshooting"
    ]
  },
  {
    "slug": "materials",
    "title": "자료 공유",
    "description": "공유 자료 검색·다운로드, 태그와 파일 업로드, 저장 공간 안내.",
    "category": "school",
    "features": [
      "/materials",
      "/materials/new"
    ],
    "sections": [
      {
        "title": "찾아서 내려받기",
        "body": "공유됨 또는 내 자료를 선택하고 제목·파일명·태그로 검색해요. 태그 필터를 눌러 범위를 좁힌 뒤 다운로드를 선택하세요. 학생과 연구·개발 공간에서 같은 자료 공유 기능을 사용할 수 있어요.",
        "links": [
          {
            "label": "자료 공유",
            "href": "https://cbgpu.com/materials"
          }
        ]
      },
      {
        "title": "자료 올리기",
        "body": "새 자료 화면에서 파일과 제목을 입력하고 태그를 최대 8개 추가해 업로드해요. 다른 이용자와 공유하는 기능이므로 공유해도 되는 파일인지 먼저 확인하세요. 전송이 완료되고 목록에서 확인될 때까지 페이지를 유지하세요.",
        "links": [
          {
            "label": "자료 업로드",
            "href": "https://cbgpu.com/materials/new"
          }
        ]
      },
      {
        "title": "파일 크기와 재시도",
        "body": "현재 업로드 화면의 파일당 상한은 1 GiB예요. 전송은 나누어 처리하며 일시적인 실패 시 진행 상태를 확인해 재시도해요. 업로드가 끝나고 목록에 표시될 때까지 브라우저를 열어 두세요. 서버 저장 공간 제한도 적용되므로 화면의 용량 안내를 함께 확인하세요."
      },
      {
        "title": "공유 범위·삭제",
        "body": "공유 자료에는 다른 사람에게 보여도 되는 파일만 올리세요. 내 자료에서는 본인이 올린 항목을 확인하고 삭제할 수 있어요. 로컬 원본까지 자동으로 지워지는 것은 아니에요."
      },
      {
        "title": "NetworkError·공간 부족",
        "body": "로그인 상태와 네트워크를 확인한 뒤 다시 시도해요. 저장 공간 부족 메시지면 같은 파일을 반복 업로드하지 말고 불필요한 본인 자료를 정리하거나 관리자에게 문의하세요. 파일 크기와 발생 시각을 함께 남기면 도움이 돼요."
      }
    ],
    "related": [
      "feature-search",
      "troubleshooting"
    ],
    "keywords": [
      "파일공유",
      "업로드",
      "다운로드",
      "storage"
    ]
  },
  {
    "slug": "gpu-notebook",
    "title": "GPU 예약·Jupyter",
    "description": "예약 신청, 사용 시간 연장, 승인 상태와 공개 Jupyter 접속, 결과 보관.",
    "updatedAt": "2026-11-22",
    "category": "research",
    "features": [
      "/dashboard",
      "/compute",
      "/schedule"
    ],
    "sections": [
      {
        "title": "GPU와 일정 선택",
        "body": "연구·개발의 GPU 예약에서 장비별 일정을 확인하고 필요한 GPU와 시작·종료 시간을 골라 신청해요. 다른 사람의 예약과 겹치지 않는지 확인하세요.",
        "links": [
          {
            "label": "GPU 예약",
            "href": "https://researcher.cbgpu.com/dashboard"
          }
        ]
      },
      {
        "title": "신청과 승인 구분",
        "body": "신청했다고 바로 사용할 수 있는 것은 아니에요. 내 예약에서 승인 대기·승인·거절와 사용 시간을 확인하세요. 승인된 예약이어도 실제 접속 정보 제공 여부는 현재 이용 권한과 사용 가능 시간에 따라 달라져요."
      },
      {
        "title": "사용 시간 연장",
        "body": "사용 중인 내 예약에서 ‘사용 연장’을 누르고 새 종료 시간을 선택해요. 다음 예약 시작 시각과 학교의 이용 가능 기간을 넘겨 연장할 수 없어요. 승인 대기 중인 예약도 보호하며, 최종 연장 요청 때 서버에서 예약 상황을 다시 확인해요. 다른 예약이 생겼다면 시간을 다시 확인하세요. 기존 예약의 종료 시각만 바뀌며 새 예약을 만드는 방식은 아니에요. 이미 종료됐거나 승인되지 않은 예약은 연장할 수 없어요. 새 학교용 실행기에 이미 Jupyter 작업이 있는 경우에는 지금은 사용 중 연장을 지원하지 않아요. 화면에 표시된 사유와 기존 종료 시각을 확인해 주세요."
      },
      {
        "title": "Jupyter 열기",
        "body": "사용 가능한 승인 예약의 접속 정보를 확인하고 해당 GPU의 Notebook을 열어요. GPU별 주소를 혼동하지 마세요. 공개 HTTPS 주소라도 접속 인증은 별도로 필요해요.",
        "links": [
          {
            "label": "GPU #1 Jupyter",
            "href": "https://gpu.cbgpu.com/1/"
          },
          {
            "label": "GPU #2 Jupyter",
            "href": "https://gpu.cbgpu.com/2/"
          },
          {
            "label": "GPU #3 Jupyter",
            "href": "https://gpu.cbgpu.com/3/"
          },
          {
            "label": "GPU #4 Jupyter",
            "href": "https://gpu.cbgpu.com/4/"
          }
        ]
      },
      {
        "title": "새 학교 GPU 서버 연결 (관리자)",
        "body": "관리자 페이지에서 학교를 선택하고 GPU nodes → Add a GPU server를 열어요. Ubuntu x86_64와 기존 NVIDIA 드라이버를 지원해요. 발급한 등록 파일은 10분 동안 한 번만 사용할 수 있으니 GPU 서버로 안전하게 옮기고, 화면의 체크섬 확인이 포함된 설치 명령을 실행하세요. 설치기는 기존 GPU 제어기를 교체하지 않아요. 로그아웃·재부팅 후에도 상태 수집이 필요하면 설치기가 안내하는 사용자 서비스의 linger 상태를 확인하세요. 새 노드의 Inventory online은 서명된 상태 보고를 받았다는 뜻이며, 학생 예약·원격 Jupyter 실행 준비 완료나 학교 밖 GPU 공유를 의미하지 않아요. 기존 운영 GPU의 예약·접속 방식은 그대로 유지돼요.",
        "links": [{"label": "학교별 GPU 연결", "href": "https://admin.cbgpu.com/admin/schools"}]
      },
      {
        "title": "설치 도우미로 연결하기",
        "body": "학교 관리자 화면의 GPU 서버에서 Linux AppImage를 내려받아 실제 GPU 서버에서 실행하세요. 도우미에서 환경을 검사하고 Jupyter 실행 이미지를 준비한 다음, 학교 관리 화면에서 연결 파일을 발급하세요. 파일 하나에 등록 정보와 실행 정책이 담기며 도우미에서 Jupyter 설치를 직접 선택해야 해요. 드라이버나 Docker 권한을 자동으로 바꾸지 않아요. Windows EXE는 현재 환경 검사와 WSL2 준비 안내용이며 자동 설치는 검증 중이에요. 다른 예약 제어기가 이미 관리하는 GPU를 새 실행기에 중복 연결하지 마세요.",
        "links": [{"label": "학교별 GPU 서버 관리", "href": "https://admin.cbgpu.com/admin/schools"}]
      },
      {
        "title": "새 학교 GPU 예약과 Jupyter",
        "body": "학교 GPU 화면에서 선택한 학교의 자원을 확인해요. 실행 환경과 보안 연결 검사를 모두 통과한 자원만 예약할 수 있어요. 예약 시간에 Jupyter 실행을 요청하고 RUNNING 상태가 확인되면 Jupyter 열기를 누르세요. 노트북은 CBGPU 계정과 분리된 접속 주소에서 열리며, 예약 종료나 권한 회수 후에는 접속할 수 없어요. 새 실행 환경의 파일은 임시 저장소이므로 종료 전에 필요한 결과를 내려받으세요. 학교 서버를 보호하기 위해 노트북의 외부 네트워크 접속은 차단돼요.",
        "links": [{"label": "학교 GPU 예약", "href": "https://cbgpu.com/compute"}]
      },
      {
        "title": "작업 마치기",
        "body": "예약이 끝나기 전에 필요한 코드·데이터·결과를 별도로 저장해요. 대시보드에 제공되는 종료 기능과 종료 시간을 확인하세요. 세션 저장공간은 영구 보관함이 아니에요. 필요한 파일은 종료 전에 내려받아 주세요."
      },
      {
        "title": "접속 실패",
        "body": "GPU 번호, 예약 승인 상태, 현재 시간과 표시된 접속 정보를 다시 확인해요. 계속 실패하면 예약 ID와 오류 문구를 전달하되 비밀번호·개인 키는 보내지 않아요."
      }
    ],
    "related": [
      "ssh",
      "profile",
      "contact"
    ]
  },
  {
    "slug": "ssh",
    "title": "SSH로 GPU 사용하기",
    "description": "SSH 공개키, 실제 접속 설정과 VS Code 등 원격 도구 이용.",
    "category": "research",
    "features": [
      "/dashboard/ssh-guide"
    ],
    "sections": [
      {
        "title": "개인 공개키 준비",
        "body": "개인 컴퓨터에서 SSH 키를 만들고 .pub 공개키 파일을 준비해요. 같은 이름의 기존 키는 덮어쓰지 마세요. 이미 쓰는 키가 있다면 그 공개키를 사용할 수 있어요. 비공개키는 개인 컴퓨터에만 보관해요.",
        "code": "ssh-keygen -t ed25519"
      },
      {
        "title": "프로필에 등록",
        "body": "프로필의 SSH 공개키 칸에 공개키 한 줄을 붙여넣고 저장해요. 키 파일 경로나 비공개키 본문을 붙여넣는 것이 아니에요.",
        "links": [
          {
            "label": "공개키 등록",
            "href": "https://researcher.cbgpu.com/profile"
          }
        ]
      },
      {
        "title": "예약과 공식 설정 확인",
        "body": "승인된 GPU 예약을 준비한 뒤 SSH 안내에서 실제 게이트웨이·포트·사용자명·클라이언트 설정을 확인해요. 장비와 운영 설정에 따라 달라질 수 있으므로 접속 주소와 설정은 SSH 안내 화면에 표시된 값을 그대로 사용해 주세요.",
        "links": [
          {
            "label": "실제 SSH 접속 안내",
            "href": "https://researcher.cbgpu.com/dashboard/ssh-guide"
          },
          {
            "label": "예약 확인",
            "href": "https://researcher.cbgpu.com/dashboard"
          }
        ]
      },
      {
        "title": "터미널·VS Code에서 연결",
        "body": "안내에 나온 명령이나 SSH 설정을 개인 클라이언트에 적용해요. 최초 연결의 호스트 키 안내를 확인하고, 작업이 끝나면 결과를 저장한 뒤 접속을 종료하세요. Permission denied는 공개키·사용자명·예약 권한을, 시간 초과는 주소·포트·네트워크를 우선 확인해요."
      }
    ],
    "related": [
      "gpu-notebook",
      "profile"
    ]
  },
  {
    "slug": "latex",
    "title": "LaTeX 논문 작성·ZIP 가져오기",
    "description": "Overleaf 프로젝트 가져오기, 컴파일러 선택, PDF와 소스 내보내기.",
    "category": "research",
    "features": [
      "/latex"
    ],
    "sections": [
      {
        "title": "내 프로젝트 열기",
        "body": "연구·개발의 논문 작성에서 CBGPU 계정으로 로그인하고 내 프로젝트를 열어요. 프로젝트 목록에서 이름을 검색하거나 내 프로젝트의 휴지통 버튼으로 삭제할 수 있어요. 삭제한 프로젝트는 Overleaf 휴지통에서 복원할 수 있고, Overleaf에서 삭제한 항목도 목록에서 제외돼요. ZIP이 없다면 빈 프로젝트를 눌러 새 문서로 시작하고, 편집기 프로젝트 관리에서 기존 프로젝트를 관리할 수 있어요.",
        "links": [
          {
            "label": "논문 작성",
            "href": "https://researcher.cbgpu.com/latex"
          }
        ]
      },
      {
        "title": "기존 ZIP 가져오기",
        "body": "Overleaf에서 받은 Source ZIP이나 TeX 소스 ZIP을 준비해요. 폴더 구조, 그림과 .bib 파일을 함께 보존하세요.",
        "steps": [
          "ZIP 가져오기로 파일을 골라요.",
          "확인 결과에서 프로젝트 이름과 메인 TeX 파일을 선택해요.",
          "pdfLaTeX·XeLaTeX·LuaLaTeX 등 프로젝트에 맞는 컴파일러를 선택해요.",
          "가져오고 편집기 열기를 눌러 PDF를 확인해요."
        ]
      },
      {
        "title": "크기와 컴파일 제한",
        "body": "ZIP 업로드와 압축 해제 후 전체·개별 파일 용량에 별도의 고정 상한을 두지 않아요. 큰 ZIP은 자동으로 나누어 전송하며 최대 1,000개 파일을 지원해요. 현재 컴파일 시간 제한은 5분이에요. 컴파일이 멈추면 로그에서 메인 파일, 그림과 참고문헌의 누락 여부를 확인해 주세요."
      },
      {
        "title": "편집·PDF·백업",
        "body": "편집기의 소스·PDF와 컴파일 로그를 사용해요. 자동 저장 상태를 확인하고 PDF와 소스 ZIP을 필요할 때 내려받아 보관하세요. 특정 학술지 양식을 강제로 적용하지 않으므로 기존 클래스·스타일 파일도 프로젝트에 포함해요."
      },
      {
        "title": "공유와 개인정보",
        "body": "프로젝트는 로그인 계정의 권한으로 관리돼요. 다른 사용자에게 자동 공개되지는 않지만 명시적 공동작업자나 서버·백업 관리자는 접근할 수 있어 종단간 암호화 보관함과는 달라요. 공개 프리프린트로 게시하려면 별도로 arXiv에서 제출해요."
      }
    ],
    "related": [
      "publishing",
      "notes",
      "troubleshooting"
    ],
    "keywords": [
      "라텍스",
      "레이텍스",
      "overleaf",
      "tex",
      "zip"
    ]
  },
  {
    "slug": "notes",
    "title": "연구노트",
    "description": "Markdown 기록, 태그, 자동 저장과 공유 범위.",
    "category": "research",
    "features": [
      "/notes"
    ],
    "sections": [
      {
        "title": "노트 만들기",
        "body": "연구노트에서 새 노트를 만들고 제목과 내용을 작성해요. 실험 목적, 조건, 결과와 다음 할 일을 함께 남기면 나중에 찾기 쉬워요.",
        "links": [
          {
            "label": "연구노트",
            "href": "https://researcher.cbgpu.com/notes"
          }
        ]
      },
      {
        "title": "작성과 미리보기",
        "body": "Markdown으로 제목·목록·코드 등을 작성하고 미리보기에서 표시 결과를 확인해요. 태그를 붙이면 주제별로 찾기 쉬워요. 자동 제안이 나와도 실제 내용에 맞는 태그인지 확인하세요."
      },
      {
        "title": "저장 상태 확인",
        "body": "입력 후 자동 저장이 진행되며 저장 중·저장 완료 상태를 확인할 수 있어요. 저장이 실패했을 때는 창을 바로 닫지 말고 내용을 별도로 복사한 뒤 네트워크와 로그인을 확인해요."
      },
      {
        "title": "공유와 삭제",
        "body": "내 노트와 공유된 노트를 구분하세요. 공유 설정을 켜기 전에 다른 사용자가 읽어도 되는 내용인지 확인해요. 다른 사람이 공유한 노트를 읽는 것과 소유자 권한으로 편집하는 것은 달라요. 불필요한 본인 노트는 삭제 확인을 거쳐 정리해요."
      }
    ],
    "related": [
      "materials",
      "latex"
    ]
  },
  {
    "slug": "frontend-deployment",
    "title": "프론트엔드 배포",
    "description": "Git 저장소를 연결해 웹사이트를 올리고 로그·설정·재배포 확인하기.",
    "category": "deploy",
    "features": [
      "/deploy",
      "/deploy/new"
    ],
    "sections": [
      {
        "title": "어떤 프로젝트에 쓰나요?",
        "body": "HTML·CSS·JavaScript, Vite, Astro, Next.js 등 웹사이트 프론트엔드를 배포할 때 사용해요. API 서버나 여러 백엔드 컨테이너가 필요한 프로젝트는 서버 배포도 함께 살펴보세요.",
        "links": [
          {
            "label": "프론트엔드 배포",
            "href": "https://researcher.cbgpu.com/deploy"
          },
          {
            "label": "새 프로젝트",
            "href": "https://researcher.cbgpu.com/deploy/new"
          }
        ]
      },
      {
        "title": "저장소와 루트 폴더",
        "body": "새 프로젝트에서 GitHub 저장소 URL, 프로젝트 이름과 브랜치를 입력해요. 비공개 저장소는 읽기 권한이 있는 GitHub 토큰이 필요해요. 소스가 저장소 안의 하위 폴더에 있으면 프로젝트 폴더를 그 상대 경로로 지정해요. 예를 들어 저장소의 web 폴더라면 web을 입력해요."
      },
      {
        "title": "빌드 설정과 환경변수",
        "body": "감지된 프레임워크, 설치·빌드 명령과 빌드 결과 폴더를 확인하고 배포 요청을 눌러요. 브라우저에 포함되는 환경변수에는 비밀키를 넣지 마세요. API 키처럼 서버에서만 쓰는 값과 공개해도 되는 값을 구분해요."
      },
      {
        "title": "주소·상태·로그",
        "body": "기본 주소는 설정한이름.front.cbgpu.com이에요. 프로젝트의 배포 목록과 빌드 로그에서 설치·빌드·실행 중 어느 단계가 실패했는지 확인해요. 초기 HTTPS 준비에 시간이 걸릴 수 있어요."
      },
      {
        "title": "업데이트와 복원",
        "body": "설정한 브랜치의 변경을 자동으로 확인하는 자동 배포 옵션을 사용할 수 있어요. 수동 배포도 프로젝트의 설정된 저장소·브랜치를 기준으로 해요. 코드 수정 후 실제 배포 커밋과 로그를 확인하고, 제공되는 정상 배포 복원 기능을 사용해 이전 결과를 다시 지정할 수 있어요."
      }
    ],
    "related": [
      "server-deployment",
      "collaboration-domains",
      "troubleshooting"
    ],
    "keywords": [
      "frontend",
      "프론트",
      "git",
      "github",
      "vercel"
    ]
  },
  {
    "slug": "server-deployment",
    "title": "서버·백엔드 배포",
    "description": "Git·Docker 이미지·Docker Compose, 루트 폴더와 포트, 설정 수정과 재배포.",
    "category": "deploy",
    "features": [
      "/server",
      "/server/new"
    ],
    "sections": [
      {
        "title": "배포 방식 고르기",
        "body": "Spring·Node.js·Python 등 백엔드나 데이터베이스와 함께 동작하는 서비스를 올릴 때 사용해요. Git 기반 런타임, Docker 이미지 또는 Docker Compose 중 프로젝트에 맞는 방식을 골라요.",
        "links": [
          {
            "label": "서버 목록",
            "href": "https://researcher.cbgpu.com/server"
          },
          {
            "label": "서버 만들기",
            "href": "https://researcher.cbgpu.com/server/new"
          }
        ]
      },
      {
        "title": "Git과 이미지 설정",
        "body": "Git은 저장소·브랜치·프로젝트 폴더·런타임·실행 명령을 확인해요. 저장소의 server 폴더만 쓸 때는 상대 경로 server를 지정하세요. Docker 이미지는 실행할 이미지와 컨테이너 내부 서비스 포트를 지정해요. 사이트에서 제공하는 런타임·프리셋 중 실제 프로젝트에 맞는 것을 선택해요."
      },
      {
        "title": "Docker Compose 설정",
        "body": "여러 컨테이너가 필요하면 Compose 모드를 선택해요. Compose 파일 경로, 외부 연결을 받을 HTTPS 연결 서비스 이름, 컨테이너 포트와 CPU·RAM·저장 공간을 확인해요. 서버 RAM은 최대 16GB까지 선택할 수 있으며, 기존 프로젝트의 변경값은 재배포할 때 적용돼요. 예를 들어 api-gw가 HTTP를 8000번으로 제공한다면 서비스 이름과 내부 포트를 그 값으로 입력해요. 실제 저장소의 Compose 정의와 일치해야 해요."
      },
      {
        "title": "공개 범위와 주소",
        "body": "Private·School·Public의 접속 범위를 읽고 필요한 범위를 골라요. Public 서버의 기본 주소는 설정한이름.server.cbgpu.com이에요. 관리자의 배포 승인 단계를 별도로 기다리는 방식은 아니지만 계정 확인과 자원·설정 조건은 충족해야 해요."
      },
      {
        "title": "설정만 저장과 재배포",
        "body": "프로젝트 상세의 설정 수정에서 “설정만 저장” 또는 “저장 후 재배포”를 구분하세요. 저장만 한 값은 다음 배포에 적용돼요. Git 재배포는 설정된 저장소·브랜치에서 코드를 가져와 실행해요. 로컬 컴퓨터에서 수정만 하고 Git에 올리지 않은 코드는 포함되지 않아요."
      },
      {
        "title": "볼륨과 실패 로그",
        "body": "데이터베이스·업로드 파일은 적절한 영구 볼륨에 보관하고 별도로 백업하세요. 재배포는 데이터 이전 작업을 자동으로 대신하지 않아요. Compose가 unhealthy이면 실패 서비스명, 상태·컨테이너 로그와 헬스체크 출력을 확인하세요. 실패를 고치기 위해 데이터 볼륨부터 지우지 마세요."
      }
    ],
    "related": [
      "collaboration-domains",
      "troubleshooting"
    ],
    "keywords": [
      "backend",
      "docker",
      "compose",
      "spring",
      "python",
      "node",
      "백엔드"
    ]
  },
  {
    "slug": "collaboration-domains",
    "title": "배포 공동작업·커스텀 도메인",
    "description": "프로젝트 멤버 관리, 기본 주소와 내 도메인 DNS·HTTPS 연결.",
    "category": "deploy",
    "features": [],
    "sections": [
      {
        "title": "같이 작업할 사람 추가",
        "body": "프로젝트의 공동작업 영역에서 함께 작업할 사람의 CBGPU 이메일과 권한을 입력해 추가해요. 팀원의 역할에 따라 가능한 작업이 달라지므로 실제로 필요한 권한을 선택하고 더 이상 필요 없는 권한은 제거하세요."
      },
      {
        "title": "기본 주소 사용",
        "body": "프론트엔드는 이름.front.cbgpu.com, 공개 서버는 이름.server.cbgpu.com을 사용해요. 접속 주소는 프로젝트 화면에 표시된 실제 주소를 복사해 사용해 주세요."
      },
      {
        "title": "내 도메인 연결",
        "body": "프로젝트의 도메인 영역에서 소유한 호스트명을 추가해요.",
        "steps": [
          "예: www.example.com을 입력해 도메인을 추가해요.",
          "화면에 나온 DNS 레코드의 Type·Name·Value를 DNS 제공업체에 그대로 등록해요.",
          "같은 이름의 기존 레코드와 충돌하는지 확인해요.",
          "연결 확인을 눌러 DNS 상태와 HTTPS 상태를 각각 확인해요."
        ]
      },
      {
        "title": "HTTPS와 제거",
        "body": "DNS 확인 대기, HTTPS 발급 대기, HTTPS 설정 대기, 연결 완료를 구분해요. DNS 확인만으로 모든 제공업체의 HTTPS 설정이 자동 완료되는 것은 아니에요. 화면에 공급자 설정 안내가 있으면 운영자에게 요청하세요. 외부 도메인 연결을 지워도 기본 CBGPU 주소와 프로젝트는 유지돼요."
      }
    ],
    "related": [
      "frontend-deployment",
      "server-deployment"
    ]
  },
  {
    "slug": "printing",
    "title": "3D 프린팅 신청",
    "description": "초보자·고급자 모드, 파일별 설정과 담당자·대기열 확인.",
    "category": "making",
    "features": [
      "/manufacturing",
      "/manufacturing/print",
      "/manufacturing/print/new"
    ],
    "sections": [
      {
        "title": "현황부터 확인",
        "body": "3D 프린팅 화면에서 프린터 상태와 내 신청을 확인하고 신청하기를 눌러요. 레이저 커팅은 별도 화면이므로 필요한 제작 방식을 먼저 고르세요.",
        "links": [
          {
            "label": "프린터 현황·내 신청",
            "href": "https://researcher.cbgpu.com/manufacturing/print"
          },
          {
            "label": "3D 프린팅 신청",
            "href": "https://researcher.cbgpu.com/manufacturing/print/new"
          }
        ]
      },
      {
        "title": "프린터와 모드",
        "body": "사용할 프린터를 선택해요. 초보자 모드는 슬라이싱 전 원본 3MF를 올려 담당자에게 슬라이싱을 요청하는 흐름이고, 고급자 모드는 본인이 Bambu Studio에서 슬라이싱한 완료 파일로 출력을 요청하는 흐름이에요."
      },
      {
        "title": "파일과 수량",
        "body": "현재 화면은 .3mf를 받으며 .stl·.obj는 3mf 변환을 진행해요. 파일별 수량·플레이트 수·필라멘트와 사용 목적을 확인해요. 여러 파일을 선택했다면 각 항목을 확인한 뒤 제출하세요. 각 프린터의 작업 선택 목록에는 그 프린터로 신청한 접수 작업만 표시돼요."
      },
      {
        "title": "담당자와 상태",
        "body": "선택한 프린터 담당자 중에서 지정하거나 수락 가능한 담당자에게 맡길 수 있어요. 접수·대기열·프린팅 중·완료 등 상태를 내 신청에서 확인하세요. 접수는 출력 완료가 아니며 제작 완료 후 수령 방법은 담당자 안내에 따라요."
      },
      {
        "title": "취소·반려·변환 실패",
        "body": "상세 화면에서 가능한 취소 동작과 반려 사유를 확인해요. 이미 작업이 진행되었다면 담당자에게 먼저 문의하세요. 파일 변환이 실패하면 원본 모델이 열리는지 확인하고 지원 형식으로 다시 내보내세요."
      }
    ],
    "related": [
      "laser-cutting",
      "equipment-console",
      "app"
    ]
  },
  {
    "slug": "laser-cutting",
    "title": "레이저 커팅 신청",
    "description": "DXF·SVG·DWG, 재질·두께·수량 설정과 완료 확인.",
    "category": "making",
    "features": [
      "/manufacturing/laser",
      "/manufacturing/laser/new"
    ],
    "sections": [
      {
        "title": "레이저 화면 열기",
        "body": "레이저 커팅에서 내 신청을 확인하고 새 신청을 열어요. 3D 프린팅과 별도 화면·대기열을 사용해요.",
        "links": [
          {
            "label": "레이저 내 신청",
            "href": "https://researcher.cbgpu.com/manufacturing/laser"
          },
          {
            "label": "레이저 신청",
            "href": "https://researcher.cbgpu.com/manufacturing/laser/new"
          }
        ]
      },
      {
        "title": "도면과 변환",
        "body": "현재 지원 형식은 .dxf·.svg·.dwg예요. DXF는 그대로 사용하고 SVG·DWG는 DXF로 변환해요. 변환 완료 표시와 결과 파일을 확인하고, 치수·선·단위가 의도한 설계인지 담당자와 확인하세요."
      },
      {
        "title": "재질·두께·수량",
        "body": "사용 목적을 입력하고 파일마다 등록된 재질·두께와 수량을 골라요. 여러 파일은 각각 별도 신청 건으로 접수돼요. 재질 목록이 비어 있으면 임의 값을 넣지 말고 담당자에게 등록을 요청하세요."
      },
      {
        "title": "담당자·작업·수령",
        "body": "담당자 지정과 메모를 확인해 제출하고 내 신청에서 대기·작업 중·완료·반려 상태를 확인해요. 실제 장비 조작과 재료 사용은 담당자 안내에 따라요. 완료 표시 후에도 수령 여부를 확인하세요."
      }
    ],
    "related": [
      "printing",
      "equipment-console",
      "app"
    ]
  },
  {
    "slug": "contests",
    "title": "대회·행사",
    "description": "참가 신청부터 작품 제출, 체크인과 주최자 운영까지.",
    "category": "community",
    "features": [
      "/contests",
      "/contests/new"
    ],
    "sections": [
      {
        "title": "참가할 대회 찾기",
        "body": "교내 대회에서 행사 상세를 열어 설명·일정·참가 조건과 마감을 확인해요.",
        "links": [
          {
            "label": "대회 목록",
            "href": "https://cbgpu.com/contests"
          }
        ]
      },
      {
        "title": "신청·작품 제출",
        "body": "대회가 요구하는 이름·팀명과 각 질문을 작성해요. 파일 항목은 해당 항목의 확장자와 최대 크기를 확인하세요. 필요한 입력·업로드를 완료한 뒤 제출 결과와 접수 상태를 확인해요."
      },
      {
        "title": "수정·체크인",
        "body": "대회 상세에서 제공되는 내 신청·수정·취소·체크인 기능을 이용해요. 수정 가능 여부와 체크인 시간은 행사 설정에 따라 다르므로 마감이나 운영 안내를 먼저 확인하세요."
      },
      {
        "title": "대회 만들기·운영",
        "body": "주최자는 새 대회에서 설명, 일정, 참가·제출 양식과 파일 조건 등을 설정해요. 운영 화면에서 참가자와 제출물을 확인하고 제공되는 관리·내보내기 기능을 사용해요. 참가자 개인정보나 제출물을 공개하려면 행사 안내와 동의를 확인하세요.",
        "links": [
          {
            "label": "대회 만들기",
            "href": "https://cbgpu.com/contests/new"
          }
        ]
      }
    ],
    "related": [
      "materials",
      "contact"
    ]
  },
  {
    "slug": "study-groups",
    "title": "스터디 매칭",
    "description": "모집 글 만들기, 과목·태그 검색, 참여·탈퇴와 모집 종료.",
    "category": "community",
    "features": [
      "/match"
    ],
    "sections": [
      {
        "title": "모집 글 살펴보기",
        "body": "전체 목록에서 과목과 태그를 확인하고 관심 있는 스터디의 설명과 현재 인원을 읽어요. 참여 중 탭에서는 본인이 참여한 모집을 볼 수 있어요.",
        "links": [
          {
            "label": "스터디 매칭",
            "href": "https://cbgpu.com/match"
          }
        ]
      },
      {
        "title": "참여와 탈퇴",
        "body": "모집 중이고 정원이 남은 글에서 참여해요. 참여 후 멤버 목록을 확인하고 더 이상 함께하지 않을 때는 탈퇴를 사용하세요. 정원이 찼거나 모집이 끝난 글은 참여가 제한될 수 있어요."
      },
      {
        "title": "새 스터디 만들기",
        "body": "만들기에서 과목·제목·설명·정원과 태그를 입력해요. 화면의 정원 범위와 필수 입력을 지켜 등록하세요. 제목에는 공부할 내용과 모집 대상을 구체적으로 적으면 좋아요."
      },
      {
        "title": "모집 종료와 삭제",
        "body": "작성자는 모집을 닫거나 불필요한 글을 삭제할 수 있어요. 모집 종료와 글 삭제는 다르므로 참여자와의 약속이나 안내 내용을 정리한 뒤 선택하세요."
      }
    ],
    "related": [
      "feature-search",
      "polls"
    ]
  },
  {
    "slug": "polls",
    "title": "투표·설문 참여",
    "description": "진행 중·마감된 설문, 응답 제출과 공개 결과 확인.",
    "category": "community",
    "features": [
      "/polls"
    ],
    "sections": [
      {
        "title": "진행 중·마감 확인",
        "body": "투표에서 진행 중 또는 마감 목록을 선택하고 질문 설명과 마감 시각을 확인해요.",
        "links": [
          {
            "label": "투표·설문",
            "href": "https://cbgpu.com/polls"
          }
        ]
      },
      {
        "title": "질문에 응답하기",
        "body": "객관식·복수 선택·단답형·장문형·숫자 척도 등 질문 형식에 맞춰 응답해요. 필수 질문을 빠뜨리지 않고 제출하기를 누른 뒤 제출 결과를 확인하세요."
      },
      {
        "title": "결과 보기",
        "body": "응답 후 표시되는 결과는 해당 설문의 결과 공개 설정에 따라 달라져요. 결과를 볼 수 없다고 해서 항상 제출 실패는 아니에요. AI 요약이 있더라도 실제 집계 수치를 함께 확인하세요."
      },
      {
        "title": "운영자용 생성·마감",
        "body": "설문 생성 권한이 있는 사용자는 제목, 질문·선택지, 마감일과 결과 공개를 설정해요. 수정·마감·삭제는 권한에 따라 제공돼요. 일반 참여자에게 운영 메뉴가 보이지 않는 것은 정상일 수 있어요."
      }
    ],
    "related": [
      "admin-console",
      "contact"
    ]
  },
  {
    "slug": "feed",
    "title": "학교·기술 소식",
    "description": "학교 공지, Tech News와 서비스 장례식 탐색.",
    "category": "community",
    "features": [
      "/feed"
    ],
    "sections": [
      {
        "title": "학교 공지 보기",
        "body": "소식에서 학교 소식 탭을 선택하고 필요한 공지의 제목·내용과 원문 링크를 확인해요.",
        "links": [
          {
            "label": "소식 열기",
            "href": "https://cbgpu.com/feed"
          }
        ]
      },
      {
        "title": "Tech News",
        "body": "기술 소식 탭에서 AI·보안·임베디드 등의 글을 살펴봐요. 원문을 열어 작성 시점과 전체 내용을 확인하세요."
      },
      {
        "title": "Graveyard",
        "body": "서비스 장례식 탭은 종료된 서비스와 관련 이야기를 읽는 코너예요. 현재 이용할 수 있는 CBGPU 기능 목록과는 다른 콘텐츠예요."
      },
      {
        "title": "자료가 갱신되지 않을 때",
        "body": "외부 제공처의 사정에 따라 지연되거나 일시적으로 비어 있을 수 있어요. 새로고침 후에도 계속 실패하면 탭 이름과 발생 시각을 함께 문의하세요."
      }
    ],
    "related": [
      "contact",
      "feature-search"
    ]
  },
  {
    "slug": "tools",
    "title": "집중 타이머·D-day",
    "description": "포모도로 시작·일시정지, 날짜 카운트다운 추가·삭제.",
    "category": "community",
    "features": [
      "/tools"
    ],
    "sections": [
      {
        "title": "포모도로 선택",
        "body": "도구에서 포모도로 탭을 고르고 집중·휴식 프리셋을 선택해요. 시작, 일시정지와 초기화를 목적에 맞게 사용하세요.",
        "links": [
          {
            "label": "도구 열기",
            "href": "https://cbgpu.com/tools"
          }
        ]
      },
      {
        "title": "타이머와 알림",
        "body": "알림·소리를 사용하려면 해당 화면과 기기의 권한을 확인해요. 브라우저를 닫거나 앱이 절전 상태가 되면 동작이 달라질 수 있으니 시험·일정의 유일한 알람으로 의존하지 마세요."
      },
      {
        "title": "D-day 추가",
        "body": "D-day 탭에서 시험·행사 이름, 날짜와 표시를 입력해 추가해요. 당일은 D-Day, 남은 날과 지난 날은 각각 표시 방식에 따라 확인할 수 있어요."
      },
      {
        "title": "기기별 저장",
        "body": "D-day 목록은 현재 브라우저의 저장 공간을 사용해요. 다른 기기와 자동 동기화된다고 가정하지 말고, 기기 변경이나 브라우저 데이터 정리 전에 필요한 날짜를 따로 보관하세요."
      }
    ],
    "related": [
      "app",
      "profile"
    ],
    "keywords": [
      "디데이",
      "뽀모도로",
      "타이머",
      "카운트다운"
    ]
  },
  {
    "slug": "games",
    "title": "게임·아케이드",
    "description": "제공되는 게임과 터치·키보드 조작 안내.",
    "category": "community",
    "features": [
      "/games"
    ],
    "sections": [
      {
        "title": "게임 고르기",
        "body": "아케이드의 게임 선택 줄에서 원하는 게임을 골라요. 현재 화면에는 Flappy, Memory, Mines, Snake, Tetris, 2048이 있어요.",
        "links": [
          {
            "label": "게임 열기",
            "href": "https://cbgpu.com/games"
          }
        ]
      },
      {
        "title": "터치와 키보드",
        "body": "게임 이름 옆의 touch·keys 안내와 화면 안의 조작 설명을 확인해요. 휴대폰에서는 터치 지원 게임부터 이용하고, 키보드 게임은 키 입력을 받을 수 있는 기기에서 사용하세요."
      },
      {
        "title": "다시 시작·전환",
        "body": "각 게임의 시작·재시작 버튼과 안내를 사용해요. 게임을 바꾸거나 페이지를 닫으면 진행 상태가 초기화될 수 있어요."
      },
      {
        "title": "게임이 안 움직일 때",
        "body": "게임 영역을 한 번 눌러 입력 초점을 주고, 검색창 등 다른 입력 칸에 커서가 있지 않은지 확인하세요. 화면에 없는 게임을 예전 주소로 찾기보다는 현재 게임 목록을 기준으로 이용해요."
      }
    ],
    "related": [
      "tools",
      "contact"
    ],
    "keywords": [
      "arcade",
      "아케이드",
      "2048",
      "테트리스",
      "스네이크"
    ]
  },
  {
    "slug": "publishing",
    "title": "연구 프리프린트 읽기·게시",
    "description": "공개 논문 검색, PDF·인용 정보와 CBGPU 계정으로 원고 제출.",
    "category": "research",
    "features": [
      "https://arxiv.cbgpu.com",
      "/arxiv",
      "/arxiv/submit"
    ],
    "sections": [
      {
        "title": "누구나 읽기",
        "body": "arxiv.cbgpu.com은 학교 연구를 공개하는 독립 사이트예요. 공개된 논문 목록·검색·상세·PDF는 로그인 없이 읽을 수 있어요. 이곳에 게시되었다는 사실이 학술지 심사나 학교의 공식 승인을 뜻하지는 않아요.",
        "links": [
          {
            "label": "프리프린트 목록",
            "href": "https://arxiv.cbgpu.com"
          }
        ]
      },
      {
        "title": "원고 제출",
        "body": "연구 제출에서 기존 CBGPU 계정으로 로그인해요. 제목·초록·저자·소속·분야 등 필수 정보를 확인하고 PDF를 올려요. 현재 PDF 상한은 20 MiB예요.",
        "links": [
          {
            "label": "연구 제출",
            "href": "https://arxiv.cbgpu.com/submit"
          }
        ]
      },
      {
        "title": "공개 범위와 라이선스",
        "body": "공개 게시를 완료한 원고는 외부 사람도 읽고 내려받을 수 있어요. 저자·그림·데이터의 공개 권한을 확인하고 화면에서 라이선스를 선택하세요. 기본 모든 권리 보유와 선택 가능한 CC BY 4.0의 의미를 구분해요."
      },
      {
        "title": "버전·인용·후속 작업",
        "body": "상세 페이지에서 PDF, 버전과 BibTeX 인용문을 확인해요. 본인 원고의 수정·후속 버전은 화면에서 제공되는 작업을 사용하세요. LaTeX 프로젝트를 편집했다고 공개 PDF까지 자동 교체되는 것은 아니에요."
      }
    ],
    "related": [
      "latex",
      "account",
      "contact"
    ]
  },
  {
    "slug": "admin-console",
    "updatedAt": "2026-11-23",
    "title": "학교·플랫폼 관리자",
    "description": "학교별 구성원·GPU 관리와 플랫폼 전체 운영을 구분해요.",
    "category": "operations",
    "features": [
      "https://admin.cbgpu.com",
      "/school-admin",
      "/admin",
      "/admin/gpu",
      "/admin/server",
      "/admin/accounts",
      "/admin/careers",
      "/admin/manufacture",
      "/admin/materials",
      "/admin/study",
      "/admin/wakeup",
      "/admin/timetable",
      "/admin/polls",
      "/admin/manufacturing",
      "/admin/m"
    ],
    "sections": [
      {
        "title": "앱에서 쓰는 모바일 관리",
        "body": "학교 관리자는 cbgpu.com/school-admin에서 로그인해요. 계정에 연결된 관리 학교로 이동하며, 여러 학교를 관리한다면 학교를 선택할 수 있어요. 앱의 관리 공간도 해당 학교 관리자 화면을 열어요. 학교 구성원, 설정, 임시 접근, 학년도, 학교생활 연동과 GPU 예약·서버를 학교별로 관리해요. GPU 담당자는 GPU 도구만 이용할 수 있어요."
      },
      {
        "title": "Careers 지원서",
        "body": "Careers 메뉴에서 접수된 지원자를 검색하고 항목을 펼쳐 이메일, 지원 동기, 경험, 포트폴리오를 확인해요. 관리자만 조회할 수 있으며 지원서 수정·상태 변경 기능은 제공하지 않아요."
      },
      {
        "title": "대상과 로그인",
        "body": "admin.cbgpu.com은 플랫폼 전체 운영자용이에요. 학교 등록 승인, 플랫폼 계정과 공통 인프라를 관리하며 학교 관리자 권한과 구분해요. 학교 관리자 권한이 있다고 플랫폼 관리자 권한이 생기지 않으며, 반대도 마찬가지예요.",
        "links": [
          {
            "label": "관리자 로그인",
            "href": "https://cbgpu.com/school-admin"
          }
        ]
      },
      {
        "title": "Workspace 메뉴",
        "body": "학교 관리 화면의 메뉴는 선택한 학교에만 적용돼요. 전체 플랫폼 관리 화면에는 학교 등록 신청·기능 요청·플랫폼 계정·공통 배포와 같은 전체 운영 항목만 표시해요. 학교를 선택하거나 메뉴를 여는 것만으로 권한이 부여되지는 않아요."
      },
      {
        "title": "GPU·서버·계정 검토",
        "body": "학교 관리의 GPU 예약에서 전체·상태별 내역을 전환하고 이름·학번·이용 목적으로 검색해요. 충북과고에서는 기존 예약 기록도 함께 표시해요. 승인된 과거 기록은 유지돼요. 승인 대기 예약만 승인·거절할 수 있으며, 이미 사용 중인 GPU의 접속 정보를 바꾸는 승인은 차단돼요. 새 학교 GPU의 예약됨 상태는 승인 대기가 아니에요. 예약 취소·이용 중지는 확인 후 실행하며, 진행 중인 작업을 중지할 수 있으니 안내를 읽어 주세요. 서버 배포와 플랫폼 계정 관리는 전체 관리자에서 별도로 확인해요."
      },
      {
        "title": "학교생활·저장 공간 관리",
        "body": "학교 관리의 학교생활 연동에서 학교 홈페이지·급식·공지·학사일정의 정보 출처와 연결 상태를 확인해요. 학교별 기능 설정과 운영 정책을 따르며, 다른 학교의 설정을 복사하지 않아요."
      },
      {
        "title": "장비 담당자 지정",
        "body": "프린터·레이저 담당자는 전용 제작 포털을 사용해요. 학교 관리자·GPU 담당자·장비 담당자 권한은 서로 달라요. 학교 관리자 계정이라는 이유로 다른 학교의 장비나 GPU를 관리할 수는 없어요."
      }
    ],
    "related": [
      "equipment-console",
      "developer-console",
      "troubleshooting"
    ]
  },
  {
    "slug": "equipment-console",
    "title": "프린터·레이저 담당자 패널",
    "description": "담당 장비의 접수·대기열·재료 관리, 완료·수령과 앱 알림.",
    "category": "operations",
    "features": [
      "https://print.cbgpu.com",
      "https://laser.cbgpu.com",
      "https://manufacturing.cbgpu.com",
      "/manage/manufacturing",
      "/manage/manufacturing/requests",
      "/manage/manufacturing/queues",
      "/manage/manufacturing/filament",
      "/manage/manufacturing/materials"
    ],
    "sections": [
      {
        "title": "각 담당자 포털",
        "body": "프린터 담당자는 print.cbgpu.com, 레이저 담당자는 laser.cbgpu.com에서 CBGPU 계정으로 로그인해요. 제조 포털 선택 화면도 사용할 수 있어요. 본인에게 배정된 장비·역할이 있어야 하며 일반 사용자 신청 페이지와 별도예요. 관리자 권한만 있고 해당 장비의 담당자로 지정되지 않은 계정은 이 담당자 포털에 들어갈 수 없어요.",
        "links": [
          {
            "label": "프린터 담당자",
            "href": "https://print.cbgpu.com"
          },
          {
            "label": "레이저 담당자",
            "href": "https://laser.cbgpu.com"
          },
          {
            "label": "담당자 포털 선택",
            "href": "https://manufacturing.cbgpu.com"
          }
        ]
      },
      {
        "title": "프린터 Workspace",
        "body": "Overview는 현황, Print requests는 접수 목록, Printer queues는 프린터 작업 대기열, Filament stock은 재료 재고예요. 메뉴를 누르면 해당 화면만 표시돼요. 요청 상세에서 목적·파일·수량을 확인하고 수락·반려 또는 가능한 작업 상태 변경을 사용하세요."
      },
      {
        "title": "프린팅 진행과 수령",
        "body": "출력할 작업과 프린터 상태를 확인한 후 작업을 시작해요. 완료 시 필라멘트와 플레이트 등 화면의 완료 절차를 확인하고, 전달 완료는 실제로 신청자에게 전달한 뒤 기록하세요. 재고의 추가·증감·삭제는 실물을 기준으로 해요."
      },
      {
        "title": "레이저 Workspace",
        "body": "Cutting requests에서 요청·파일·재질·두께와 진행 상태를 관리해요. Materials는 신청자가 고를 재질·두께 목록을 관리하는 별도 화면이에요. 등록 항목이 없으면 신청자가 선택할 재료도 없을 수 있으므로 운영 전에 확인하세요."
      },
      {
        "title": "접수 알림과 권한 변경",
        "body": "Android 앱에 담당자 본인 계정으로 로그인하고 알림 권한·프로필 설정을 확인해요. 지정 담당자와 장비 담당 범위에 따라 알림 대상이 정해지며, 등록 기기가 없으면 수신할 수 없어요. 역할이 해제되면 기존 포털 접속도 제한돼요."
      }
    ],
    "related": [
      "printing",
      "laser-cutting",
      "app",
      "profile"
    ]
  },
  {
    "slug": "developer-console",
    "title": "CBGPU 운영 개발자 패널",
    "description": "서비스 상태·방문·배포 관찰, 테이블·SQL·터미널 등 운영 도구.",
    "category": "operations",
    "features": [
      "https://developers.cbgpu.com"
    ],
    "sections": [
      {
        "title": "이용자 개발 공간과 구분",
        "body": "developers.cbgpu.com은 CBGPU 자체를 운영하는 승인된 개발자용이에요. 사용자의 Git 프로젝트를 배포하는 연구·개발 공간과는 달라요. 등록된 운영 개발자 계정의 CBGPU 이메일·비밀번호로 로그인해요.",
        "links": [
          {
            "label": "운영 개발자 로그인",
            "href": "https://developers.cbgpu.com"
          }
        ]
      },
      {
        "title": "상태·배포·로그 관찰",
        "body": "Overview에서 방문·상태 정보를, Deployments에서 배포 현황을, Logs & services에서 로그와 서비스 정보를 확인해요. 운영 대시보드의 관찰 화면과 일반 사용자의 실제 배포 만들기 화면을 혼동하지 마세요."
      },
      {
        "title": "Table editor와 SQL editor",
        "body": "Table editor는 테이블·열과 행을 탐색하고 권한 내 데이터 작업을 하는 도구이고 SQL editor는 직접 SQL을 실행하는 도구예요. 같은 화면의 중복 메뉴가 아니에요. 행 수정·삭제나 SQL 변경은 실제 데이터에 영향을 주므로 대상과 조건을 먼저 확인해요."
      },
      {
        "title": "Terminal·Audit·Email·Security",
        "body": "Terminal은 제공되는 서버 계정의 대화형 셸로, 설치된 명령과 권한 범위 안에서 사용해요. Audit trail, Email delivery, Account & security에서 감사 기록, 메일 처리 상태와 계정·보안 정보를 살펴봐요. 명령을 입력했다고 자동으로 더 높은 운영체제 권한을 얻는 것은 아니에요."
      },
      {
        "title": "운영 정보 공유",
        "body": "일반 문의에 로그를 전달할 때 토큰, 비밀번호, 데이터베이스 연결 문자열과 개인정보를 제외하세요. 공개 Docs에는 로그인 비밀값이나 서버의 개인 자격증명을 게시하지 않아요."
      }
    ],
    "related": [
      "admin-console",
      "troubleshooting"
    ]
  },
  {
    "slug": "documentation",
    "title": "Docs 사용법·기능별 안내",
    "description": "공개 문서 검색, 분류, 목차와 기능 바로가기.",
    "category": "help",
    "features": [
      "https://docs.cbgpu.com",
      "/docs"
    ],
    "sections": [
      {
        "title": "로그인 없이 읽기",
        "body": "Docs는 학교 밖에서도 로그인 없이 읽을 수 있는 공개 사이트예요. 문서를 읽을 수 있다는 것이 실제 서비스의 계정·관리자 권한까지 제공한다는 뜻은 아니에요.",
        "links": [
          {
            "label": "문서 홈",
            "href": "https://docs.cbgpu.com"
          }
        ]
      },
      {
        "title": "검색과 분류",
        "body": "문서 홈에서 기능 이름이나 오류 문구를 검색하고 시작·계정, 학교생활, GPU·연구, 배포·협업, 제작, 대회·커뮤니티, 담당자·관리자, 도움말로 범위를 좁혀요."
      },
      {
        "title": "목차와 관련 문서",
        "body": "각 안내에는 단계별 목차와 실제 기능으로 가는 링크가 있어요. 화면에서 사용하는 이름을 기준으로 읽고, 관련 문서에서 로그인·공유·오류 처리 안내를 이어서 확인하세요."
      },
      {
        "title": "다른 화면과 차이가 날 때",
        "body": "운영 설정과 권한에 따라 메뉴나 제한이 다르게 보일 수 있어요. 실제 화면의 현재 안내를 함께 확인하고, 문서 누락·오류는 해당 문서 주소와 기능 화면을 알려 주세요."
      }
    ],
    "related": [
      "feature-search",
      "contact"
    ]
  },
  {
    "slug": "troubleshooting",
    "title": "문제 해결",
    "description": "로그인·메일·네트워크·업로드·배포·앱 화면 문제의 확인 순서.",
    "category": "help",
    "features": [],
    "sections": [
      {
        "title": "먼저 어디서 실패했는지 확인",
        "body": "기능 주소, 누른 버튼, 발생 시각과 화면에 표시된 오류를 메모해요. 인터넷 연결을 확인하고 새로고침해요. 저장·제출 같은 작업을 무조건 반복하기보다 목록에서 앞선 요청이 처리됐는지 먼저 확인하세요."
      },
      {
        "title": "로그인·권한·메일",
        "body": "로그인 페이지로 돌아가면 계정을 확인해 다시 로그인해요. Access denied나 승인·확인 필요 메시지는 프로필 정보와 역할을 점검하세요. 재설정 메일 전송 실패는 스팸함만의 문제가 아닐 수 있으므로 실제 오류 문구를 문의에 남겨요."
      },
      {
        "title": "파일 NetworkError·용량",
        "body": "자료 업로드는 파일 크기와 남은 저장 공간, 네트워크를 확인해요. 토큰이나 다운로드 링크가 만료되면 다시 로그인하거나 목록에서 다운로드를 새로 요청하세요. 실패한 파일을 공개 링크나 문의 본문에 무단으로 첨부하지 마세요."
      },
      {
        "title": "배포·Compose unhealthy",
        "body": "실패한 단계와 해당 배포의 커밋·브랜치·프로젝트 폴더·포트를 확인해요. Compose는 서비스 상태, 컨테이너 로그와 헬스체크 결과를 함께 봐요. DB 연결이나 스키마 오류를 알기 전 데이터를 지우는 방식으로 해결하려고 하지 마세요."
      },
      {
        "title": "오래된 앱 화면·알림",
        "body": "웹은 새로고침하고 앱은 완전히 닫은 뒤 다시 열어봐요. 알림은 앱 버전·로그인·기기 권한·프로필 설정을 확인해요. 문제가 남으면 문의에 재현 순서와 화면을 보내기 전에 비밀번호·토큰과 개인정보를 가려 주세요."
      }
    ],
    "related": [
      "account",
      "materials",
      "server-deployment",
      "contact"
    ]
  },
  {
    "slug": "contact",
    "title": "문의·지원·개인정보",
    "description": "어디에 무엇을 보내야 빠르게 문제를 확인할 수 있는지.",
    "category": "help",
    "features": [
      "/contact",
      "/privacy"
    ],
    "sections": [
      {
        "title": "문의 보내기",
        "body": "문의 화면에서 이름·이메일과 예약 문의, 계정 문제, 기술 지원, 기타 중 맞는 분류를 선택하고 내용을 작성해요. 전송 성공 안내를 확인하세요.",
        "links": [
          {
            "label": "문의하기",
            "href": "https://cbgpu.com/contact"
          }
        ]
      },
      {
        "title": "함께 적으면 좋은 정보",
        "body": "기능 주소, 문제 발생 시각, 누른 순서, 오류 문구와 기기·브라우저·앱 버전을 적어요. 배포는 프로젝트 ID·실패 단계, GPU는 예약 ID·GPU 번호처럼 해당 작업을 찾을 정보를 함께 적어 주세요."
      },
      {
        "title": "보내면 안 되는 정보",
        "body": "비밀번호, OTP·재설정 링크 전체, GitHub 토큰, 비공개 SSH 키와 데이터베이스 연결 문자열은 보내지 않아요. 화면 사진·로그에도 개인 정보나 토큰이 없는지 확인하세요."
      },
      {
        "title": "개인정보와 삭제",
        "body": "수집·이용 안내는 개인정보처리방침에서 확인해요. 계정 설정은 내 프로필에서, 자료·프로젝트 삭제는 해당 기능의 확인 절차를 통해 진행해요.",
        "links": [
          {
            "label": "개인정보처리방침",
            "href": "https://cbgpu.com/privacy"
          },
          {
            "label": "내 프로필",
            "href": "https://cbgpu.com/profile"
          }
        ]
      }
    ],
    "related": [
      "troubleshooting",
      "profile"
    ]
  }
];
export const guideForFeature=(href:string)=>guides.find(guide=>guide.features.includes(href));
