"""Browser smoke tests. Requires Playwright Python and an installed Chromium.

Run a server with npm start, then: python3 tests/browser_smoke.py
"""
import os
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('APP_URL', 'http://127.0.0.1:4173/')


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
                                headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1100})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL)
    page.wait_for_selector('.word-card')
    expect(page.locator('.word-card')).to_have_count(57)
    page.screenshot(path='/tmp/kanji-web-desktop.png', full_page=True)
    page.get_by_label('漢字・読みで検索').fill('バラ')
    expect(page.locator('.word-card')).to_have_count(1)
    assert '薔薇' in page.locator('.word-card').inner_text()
    page.get_by_label('漢字・読みで検索').fill('検索にない文字')
    expect(page.locator('.word-card')).to_have_count(0)
    page.get_by_role('button', name='条件をリセット').click()
    page.get_by_role('button', name='自然', exact=True).click()
    expect(page.locator('.word-card')).to_have_count(7)
    page.get_by_role('button', name='すべて', exact=True).click()
    page.locator('.word-card').first.click()
    page.wait_for_selector('#play')
    expect(page.locator('#animated path')).to_have_count(10)
    page.get_by_role('button', name='1画進む').click()
    assert page.locator('#stroke-count').inner_text() == '1 / 10 画'
    page.get_by_role('button', name='最初に戻す').click()
    assert page.locator('#stroke-count').inner_text() == '0 / 10 画'
    page.locator('#play').click()
    page.wait_for_function("Number(document.querySelector('#animated path').getAttribute('stroke-dashoffset')) < 0.8")
    page.get_by_role('button', name='一時停止').click()
    before = page.locator('#animated path').first.get_attribute('stroke-dashoffset')
    page.wait_for_timeout(150)
    assert page.locator('#animated path').first.get_attribute('stroke-dashoffset') == before
    page.get_by_label('再生速度').select_option('1.8')
    page.get_by_role('button', name='なぞって書く').click()
    box = page.locator('#board').bounding_box()
    page.mouse.move(box['x']+70, box['y']+90)
    page.mouse.down()
    page.mouse.move(box['x']+180, box['y']+190, steps=10)
    page.mouse.up()
    expect(page.locator('#ink polyline')).to_have_count(1)
    page.get_by_label('見本を表示').uncheck()
    assert not page.locator('#guide').is_visible()
    page.get_by_role('button', name='ひとつ戻す').click()
    expect(page.locator('#ink polyline')).to_have_count(0)
    assert page.get_by_role('button', name='すべて消す').is_disabled()
    page.get_by_role('button', name='この文字を練習済みにする').click()
    page.reload()
    page.wait_for_selector('#complete')
    assert '練習済み（取り消す）' in page.locator('#complete').inner_text()
    page.get_by_role('link', name='次の文字').click()
    expect(page.locator('#animated path')).to_have_count(9)
    page.get_by_role('button', name='この文字を練習済みにする').click()
    page.get_by_role('link', name='漢字一覧に戻る').click()
    expect(page.locator('.practice-count b')).to_have_text('2')
    page.get_by_label('練習済みだけ').check()
    expect(page.locator('.word-card')).to_have_count(1)
    page.get_by_role('link', name='このアプリについて').click()
    expect(page.get_by_role('heading', name='書き順データの出典')).to_be_visible()
    # Validate every SVG path with Chromium's parser, not merely a string check.
    valid = page.evaluate('''async () => {
      const data = await (await fetch('./data/glyphs.json')).json();
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg'); document.body.append(svg);
      let count = 0;
      for (const paths of Object.values(data)) for (const d of paths) {
        const path = document.createElementNS(ns, 'path'); path.setAttribute('d', d); svg.append(path);
        if (!(path.getTotalLength() > 0)) throw new Error('Invalid SVG path'); count++;
      }
      svg.remove(); return count;
    }''')
    assert valid > 1000
    print(f'Desktop: search, filters, playback/pause, tracing, undo, progress persistence, navigation passed. {valid} SVG paths validated.')
    mobile = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=1)
    phone = mobile.new_page()
    phone.on('pageerror', lambda error: errors.append(str(error)))
    phone.goto(URL)
    phone.wait_for_selector('.word-card')
    assert phone.evaluate('document.documentElement.scrollWidth <= innerWidth')
    phone.screenshot(path='/tmp/kanji-web-mobile.png', full_page=True)
    phone.locator('.word-card').first.tap()
    phone.get_by_role('button', name='なぞって書く').tap()
    phone.locator('#board').scroll_into_view_if_needed()
    board = phone.locator('#board').bounding_box()
    x, y = board['x'] + 80, board['y'] + 80
    client = mobile.new_cdp_session(phone)
    client.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for delta in range(10, 100, 10):
        client.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x+delta,'y':y+delta}]})
        phone.wait_for_timeout(25)
    client.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
    phone.wait_for_timeout(350)
    expect(phone.locator('#ink polyline')).to_have_count(1)
    assert len(phone.locator('#ink polyline').get_attribute('points').split()) > 4
    phone.screenshot(path='/tmp/kanji-web-practice-mobile.png', full_page=True)
    phone.get_by_role('button', name='すべて消す').tap()
    expect(phone.locator('#ink polyline')).to_have_count(0)
    assert phone.evaluate('document.documentElement.scrollWidth <= innerWidth')
    phone.set_viewport_size({'width':320,'height':720})
    assert phone.evaluate('document.documentElement.scrollWidth <= innerWidth')
    phone.goto(URL + '#practice/999/0')
    phone.wait_for_selector('.word-card')
    print('Mobile: 390px/320px layouts, actual touch tracing, erase, invalid route recovery passed.')
    assert not errors, errors
    browser.close()
    print('No browser runtime errors.')
