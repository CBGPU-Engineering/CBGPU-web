import { Sparkles } from 'lucide-react';

export function ComputeChatIntro() {
  return (
    <div className="pv-chat-intro">
      <span className="pv-chat-emblem"><Sparkles size={29} strokeWidth={1.55} aria-hidden="true" /></span>
      <h2>무엇을 같이 풀어볼까요?</h2>
      <p>궁금한 점을 적거나 함께 살펴볼 자료를 올려 보세요.</p>
    </div>
  );
}
