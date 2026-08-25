/**
 * 웹푸시 서비스 워커.
 *
 * 이 파일은 Next.js 빌드를 거치지 않는다 — public/ 아래는 그대로 서빙된다.
 * 그래서 순수 JS만 쓴다(TypeScript·모듈 문법 금지). 브라우저가 항상 같은 주소
 * (/sw.js)에서 최신 버전인지 바이트 단위로 비교해 새로 받는다.
 *
 * 하는 일 둘:
 *   push             서버가 보낸 푸시를 받아 알림으로 띄운다
 *   notificationclick  알림을 누르면 해당 화면으로 이동(이미 열린 탭이 있으면 그리로 포커스)
 */

self.addEventListener('push', function (event) {
  var data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: '오늘도 사랑해', body: event.data ? event.data.text() : '' }
  }

  var title = data.title || '오늘도 사랑해'
  var options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  var url = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i]
        var clientPath = new URL(client.url).pathname
        if (clientPath === url && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    }),
  )
})
