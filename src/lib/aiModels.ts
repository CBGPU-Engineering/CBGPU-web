export const chatModels=[
 {id:'cbgpu-oss',name:'GPT-OSS 20B',description:'OpenAI gpt-oss · 추론과 분석'},
 {id:'cbgpu-chat',name:'CBGPU Chat',description:'Qwen2.5 7B · 빠른 대화'},
 {id:'cbgpu-coder',name:'CBGPU Coder',description:'Qwen2.5 Coder 7B · 코드와 에이전트'},
 {id:'cbgpu-pro',name:'CBGPU Pro',description:'Qwen2.5 14B · 글쓰기와 분석'},
] as const;
export const chatModelIds=new Set<string>(chatModels.map(m=>m.id));
