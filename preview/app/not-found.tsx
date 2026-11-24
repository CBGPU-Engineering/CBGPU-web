import Link from 'next/link';

export default function NotFound() {
  return <section className="pv-page">
    <h1>페이지를 찾을 수 없어요</h1>
    <p className="pv-detail-summary">주소를 다시 확인하거나 홈으로 돌아가 주세요.</p>
    <Link className="pv-primary" href="/">홈으로 돌아가기</Link>
  </section>;
}
