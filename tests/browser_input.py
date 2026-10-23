"""Regression coverage for interrupted pointer capture and touch handwriting."""
import os
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('APP_URL', 'http://127.0.0.1:4173/')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1100,'height':1000})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL+'#challenge/0/0')
    page.wait_for_selector('#challenge-board')
    page.evaluate("document.addEventListener('pointerdown', e => window.testPointerId = e.pointerId)")
    box = page.locator('#challenge-board').bounding_box()
    x,y=box['x']+70,box['y']+70
    page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+25,y+20)
    # Capture events from SVG children bubble: they must not erase the current stroke.
    page.evaluate("document.querySelector('#challenge-board .board-grid').dispatchEvent(new PointerEvent('lostpointercapture', {bubbles:true,pointerId:window.testPointerId}))")
    expect(page.locator('#answer-ink polyline')).to_have_count(1)
    page.mouse.move(x+60,y+40);page.mouse.up()
    expect(page.locator('#grade')).to_be_enabled()
    page.locator('#challenge-erase').click()
    # A genuine loss of capture must still allow move/up events to finish the stroke.
    page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+20,y+20)
    page.evaluate("document.querySelector('#challenge-board').releasePointerCapture(window.testPointerId)")
    page.mouse.move(box['x']+box['width']+15,y+90);page.mouse.up()
    expect(page.locator('#answer-ink polyline')).to_have_count(1)
    assert len(page.locator('#answer-ink polyline').get_attribute('points').split()) >= 4
    expect(page.locator('#grade')).to_be_enabled()
    page.locator('#challenge-erase').click()
    for i in range(20):
        page.mouse.move(x,y);page.mouse.down()
        page.mouse.move(x+20,y+20);page.mouse.move(x+45,y+30);page.mouse.up()
        expect(page.locator('#answer-ink polyline')).to_have_count(i+1)
    expect(page.locator('#grade')).to_be_enabled()
    page.locator('#challenge-erase').click()
    print('Mouse: child capture events and genuine capture loss retain handwriting.',flush=True)

    context = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
    phone = context.new_page();phone.on('pageerror', lambda e: errors.append(str(e)))
    phone.goto(URL+'#challenge/0/0');phone.wait_for_selector('#challenge-board')
    phone.locator('#challenge-board').scroll_into_view_if_needed()
    box=phone.locator('#challenge-board').bounding_box()
    client=context.new_cdp_session(phone)
    def draw(start_x,start_y,cancel=False):
        client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':start_x,'y':start_y}]})
        for step in range(1,5):
            client.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':start_x+step*8,'y':start_y+step*6}]})
        client.send('Input.dispatchTouchEvent',{'type':'touchCancel' if cancel else 'touchEnd','touchPoints':[]})
    # Start on a grid line, then on existing ink: every attempt must remain.
    x,y=box['x']+box['width']/2,box['y']+box['height']/2
    for i in range(8):
        draw(x,y)
        expect(phone.locator('#answer-ink polyline')).to_have_count(i+1)
    expect(phone.locator('#grade')).to_be_enabled()
    phone.wait_for_timeout(350);phone.locator('#challenge-erase').tap()
    expect(phone.locator('#answer-ink polyline')).to_have_count(0)
    phone.locator('#challenge-board').scroll_into_view_if_needed()
    box=phone.locator('#challenge-board').bounding_box();x,y=box['x']+60,box['y']+60
    draw(x,y,cancel=True)
    expect(phone.locator('#answer-ink polyline')).to_have_count(1)
    expect(phone.locator('#draw-count')).to_contain_text('中断')
    expect(phone.locator('#grade')).to_be_disabled()
    phone.wait_for_timeout(350);phone.locator('#challenge-undo').tap()
    expect(phone.locator('#answer-ink polyline')).to_have_count(0)
    phone.locator('#challenge-board').scroll_into_view_if_needed()
    box=phone.locator('#challenge-board').bounding_box();x,y=box['x']+60,box['y']+60
    draw(x,y)
    expect(phone.locator('#answer-ink polyline')).to_have_count(1)
    expect(phone.locator('#grade')).to_be_enabled()
    assert not errors,errors
    print('Touch: eight consecutive strokes on grid/ink, visible interruption, undo and recovery passed.',flush=True)
    browser.close()
