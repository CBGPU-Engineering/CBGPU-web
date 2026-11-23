/** Actionable provider error mapping. Never echo raw SQL or credentials in UI. */
export function authErrorMessage(error:unknown,action:'login'|'signup'|'recovery'|'reset'):string {
 const code=error&&typeof error==='object'&&'code'in error?String(error.code):'';
 const status=error&&typeof error==='object'&&'status'in error?Number(error.status):0;
 if(status===429||code.includes('rate_limit'))return '요청이 잠시 많아졌어요. 조금 뒤에 다시 시도해 주세요.';
 if(action==='login'&&code==='email_not_confirmed')return '이메일 인증이 필요해요. 받은 메일의 인증 링크를 눌러 주세요.';
 if(action==='login'&&['invalid_credentials','user_not_found'].includes(code))return '이메일 또는 비밀번호를 다시 확인해 주세요.';
 if(code==='weak_password')return '더 안전한 비밀번호가 필요해요. 길이를 늘리고 다른 문자도 섞어 주세요.';
 if(action==='reset'&&['session_not_found','session_expired','otp_expired','bad_jwt'].includes(code))return '재설정 링크를 사용할 수 없어요. 비밀번호 찾기에서 새 링크를 받아 주세요.';
 if(action==='signup'&&['user_already_exists','email_exists'].includes(code))return '이미 가입한 이메일이에요. 로그인하거나 비밀번호를 찾아 주세요.';
 return ({login:'로그인하지 못했어요. 입력한 정보를 확인하고 다시 시도해 주세요.',signup:'계정을 만들지 못했어요. 다시 시도하거나, 이미 가입했다면 로그인해 주세요.',recovery:'메일을 요청하지 못했어요. 이메일 주소를 확인하고 다시 시도해 주세요.',reset:'비밀번호를 바꾸지 못했어요. 새 재설정 링크로 다시 시도해 주세요.'})[action];
}
