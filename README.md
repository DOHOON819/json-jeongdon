# JSON 정돈

[사이트 사용하기](https://json-jeongdon.netlify.app/)

숫자의 원래 표기를 유지하는 한국어 JSON 작업대. 서버나 외부 라이브러리가 필요 없는 독립 정적 웹사이트입니다.

## 기능

- 엄격한 JSON 문법 검사와 오류 행·열 표시
- 공백 2칸/4칸/탭 정리, 한 줄 압축
- 큰 정수, -0, 지수, 소수의 끝자리, 이스케이프 및 키 순서 보존
- 중복 키 경고, 모든 항목 보존
- RFC 6901 JSON Pointer 추출, 중복 경로의 모호한 선택 거부
- UTF-8 로컬 파일 읽기, 결과 복사·다운로드
- 입력은 메모리에서만 처리하며 전송·영구 저장하지 않음

## 실행 및 검증

Node.js 22 이상에서 `npm test`. 로컬 미리보기는 `python -m http.server 4174 --directory dist` 후 브라우저에서 확인합니다. 배포 디렉터리는 `dist`입니다. 빌드와 설치가 필요 없습니다.

입력 최대 100만 UTF-16 코드 단위, 파일 2 MiB, 중첩 100단계, 값 10만 개, 출력 800만 코드 단위입니다. UTF-8 BOM은 파일 읽기 단계에서 제거합니다. 구문 유효성과 스키마/업무 유효성은 별개입니다.

표준: [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259), [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901). 문법 파서와 렌더러는 자체 구현이며 JSON 숫자를 JavaScript Number로 변환하지 않습니다. `JSON.parse`는 개별 문자열 키 비교에만 사용합니다.
