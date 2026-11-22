# OneTap Market — privacy

_Last updated: 22 November 2026_

## English

OneTap Market is a static catalogue. It has no server of its own, no account
system, and no analytics.

- **Almost nothing leaves your browser.** There is no tracking script, no
  advertising pixel and no analytics. Fonts are served from this folder. One
  request can happen, and only when you open a card's **Feedback & comments**
  section: the page asks GitHub's public API (`api.github.com`) for that
  repository's public issue list. GitHub sees that request the way it sees a
  visit to any of its pages. No account, no cookie from this site and nothing
  about you is attached to it — the request is read-only and sent without
  credentials.
- **One thing is stored, on your device.** The page remembers whether you chose
  English or Korean, in your browser's `localStorage` under `otm.lang`. It is
  never sent anywhere. Clearing site data removes it.
- **Opening an app leaves this site.** Every listing links to the creator's own
  domain. Once you are there, that site's privacy rules apply, not these.
- **Submitting an app, an update or feedback goes through GitHub.** Those forms
  only build a URL. When you press the button, GitHub opens in a new tab with
  your answers pre-filled; the details are posted only if you submit the issue
  while signed in, and they are then public, as GitHub issues are. Nothing is
  sent to us before that step. A nickname is optional; leave it empty and the
  issue says anonymous.
- **No payment, no email capture.** Listing is free and there is no field for a
  card or a password anywhere in this form. Do not paste credentials into it.

Questions or a removal request: open an issue at
<https://github.com/MarCJ81/onetap-market/issues>.

## 한국어

원탭 마켓은 정적 카탈로그입니다. 자체 서버도, 계정 체계도, 분석 도구도 없습니다.

- **대부분은 브라우저 밖으로 나가지 않습니다.** 추적 스크립트도, 광고 픽셀도, 분석 도구도
  없습니다. 폰트도 이 폴더에서 제공합니다. 딱 하나 예외가 있습니다. 카드의
  **피드백 · 댓글** 구역을 열 때만 이 저장소의 공개 이슈 목록을 GitHub 공개 API
  (`api.github.com`)에 한 번 물어봅니다. GitHub에는 평소 github.com을 방문했을 때와 같은
  방식으로 이 요청이 보입니다. 계정도, 이 사이트의 쿠키도, 그 밖의 내 정보도 실리지
  않습니다. 읽기 전용이고 자격 증명 없이 보냅니다.
- **기기에 하나만 저장합니다.** 영어·한국어 중 고른 언어를 브라우저 `localStorage`의
  `otm.lang`에 기억합니다. 어디로도 전송하지 않으며, 사이트 데이터를 지우면 함께 사라집니다.
- **앱을 열면 이 사이트를 떠납니다.** 모든 카드는 제작자의 도메인으로 연결됩니다. 그곳에서는
  해당 사이트의 개인정보 규칙이 적용됩니다.
- **입점·업데이트·피드백 신청은 GitHub을 거칩니다.** 세 양식 모두 URL만 만듭니다. 버튼을
  누르면 답변이 채워진 GitHub 이슈가 새 탭에서 열리고, 로그인 상태에서 이슈를 등록해야
  비로소 공개 게시됩니다. 그 전에는 저희에게 아무것도 전송되지 않습니다. 닉네임은
  선택이며, 비워 두면 익명으로 표시됩니다.
- **결제와 이메일 수집이 없습니다.** 입점은 무료이고, 카드번호나 비밀번호를 받는 칸이 양식
  어디에도 없습니다. 자격 증명은 붙여넣지 마세요.

문의·삭제 요청: <https://github.com/MarCJ81/onetap-market/issues>에 이슈를 남겨 주세요.
