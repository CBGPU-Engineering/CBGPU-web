'use client';

import {useState, useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import styles from './ChiikawaRunner.module.css';

const subscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/** A viewport companion: CSS-only motion, no animation loop or external assets. */
export default function ChiikawaRunner() {
  const [hidden, setHidden] = useState(false);
  const mounted = useSyncExternalStore(subscribe, onClient, onServer);
  if (!mounted || hidden) return null;
  return createPortal(<div className={styles.viewport} data-chiikawa-runner>
    <div className={styles.track}>
      <button type="button" className={styles.character} aria-label="뛰어다니는 치이카와 숨기기" title="치이카와 · 누르면 새로고침할 때까지 숨겨요" onClick={() => setHidden(true)}>
        <svg viewBox="0 0 96 100" fill="none" aria-hidden="true" focusable="false">
          <ellipse className={styles.shadow} cx="48" cy="94" rx="24" ry="3" fill="#302721" opacity=".15"/>
          <g stroke="#594c45" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <g className={styles.leftFoot}><ellipse cx="35" cy="84" rx="8" ry="11" fill="#fffdf9"/></g>
            <g className={styles.rightFoot}><ellipse cx="61" cy="84" rx="8" ry="11" fill="#fffdf9"/></g>
            <g className={styles.body}>
              <ellipse cx="29" cy="18" rx="9" ry="13" transform="rotate(-19 29 18)" fill="#fffdf9"/>
              <ellipse cx="67" cy="18" rx="9" ry="13" transform="rotate(19 67 18)" fill="#fffdf9"/>
              <path d="M27 13c-3 3-3 7-1 10M69 13c3 3 3 7 1 10" stroke="#efc5bc" strokeWidth="3"/>
              <path d="M22 27C29 18 67 18 74 27c9 9 13 23 10 36-3 17-16 25-36 25S15 80 12 63C9 50 13 36 22 27Z" fill="#fffdf9"/>
              <path className={styles.leftArm} d="M18 66c-11-6-14 3-7 10l9 4" fill="#fffdf9"/>
              <path className={styles.rightArm} d="M78 65c10-8 15 0 9 8l-9 7" fill="#fffdf9"/>
              <path d="m27 39 7-2m28 0 7 2" strokeWidth="2"/>
              <ellipse cx="32" cy="49" rx="4.4" ry="6.2" fill="#443a36" stroke="none"/>
              <ellipse cx="64" cy="49" rx="4.4" ry="6.2" fill="#443a36" stroke="none"/>
              <circle cx="33.4" cy="46.5" r="1.5" fill="white" stroke="none"/>
              <circle cx="65.4" cy="46.5" r="1.5" fill="white" stroke="none"/>
              <ellipse cx="24" cy="60" rx="8" ry="5" fill="#f3b4b4" opacity=".8" stroke="none"/>
              <ellipse cx="72" cy="60" rx="8" ry="5" fill="#f3b4b4" opacity=".8" stroke="none"/>
              <path d="m45 57 3 2 3-2m-3 2c-1 6-6 6-7 3m7-3c1 6 6 6 7 3" strokeWidth="2"/>
              <path d="M45 67c2 3 4 3 6 0" stroke="#d88d91" strokeWidth="2"/>
            </g>
          </g>
        </svg>
      </button>
    </div>
  </div>, document.body);
}
