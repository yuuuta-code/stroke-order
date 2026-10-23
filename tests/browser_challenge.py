"""Challenge integration checks; run against npm start or APP_URL with a subpath."""
import os
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('APP_URL', 'http://127.0.0.1:4173/')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':1280,'height':1000})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_selector('.word-card')
    verified = page.evaluate('''async () => {
      const { scoreAttempt } = await import('./scoring.js');
      const glyphs = await (await fetch('./data/glyphs.json')).json();
      const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); document.body.append(svg);
      let perfect = 0, rejected = 0;
      for (const [c, paths] of Object.entries(glyphs)) {
        const reference = paths.map(d => {
          const path = document.createElementNS(svg.namespaceURI,'path'); path.setAttribute('d',d); svg.append(path);
          const length = path.getTotalLength();
          return Array.from({length:257},(_,i) => { const p=path.getPointAtLength(length*i/256);return [p.x,p.y]; });
        });
        const good = scoreAttempt(reference,reference);
        if (good.score !== 100 || !good.passed || good.rank !== 'gold') throw Error(c+': perfect failed');
        perfect++;
        const variants = [reference.map(s=>[...s].reverse()),reference.slice(1),[...reference,reference[0]],reference.map(s=>s.map(([x,y])=>[x+25,y])),reference.map(s=>s.map(([x,y])=>[54.5+(x-54.5)*.3,54.5+(y-54.5)*.3])),reference.map(()=>[[0,0],[109,109],[0,109],[109,0]]),reference.map(s=>[s[0]])];
        if (reference.length>1) variants.push([reference[1],reference[0],...reference.slice(2)]);
        for(const bad of variants){const result=scoreAttempt(bad,reference);if(result.passed || result.score>=80)throw Error(c+': invalid passed');rejected++;}
      }
      svg.remove(); return {perfect,rejected};
    }''')
    print('Real KanjiVG geometry:', verified, flush=True)
    words = page.evaluate("fetch('./data/words.json').then(r=>r.json())")
    mountain = next(i for i,w in enumerate(words) if '山' in w['word'])
    page.evaluate("localStorage.setItem('kanji-practice-v1', JSON.stringify(['山']))")
    page.reload(); page.wait_for_selector('.word-card')
    page.goto(URL+'#collection')
    expect(page.locator('.collection-tile')).to_have_count(100)
    expect(page.locator('.collection-total b')).to_have_text('0')
    page.goto(URL+f'#challenge/{mountain}/0')
    expect(page.locator('#grade')).to_be_disabled()
    assert '山' not in page.locator('#app').inner_text()
    expect(page.locator('#answer-guide path')).to_have_count(0)
    assert not page.locator('#show-guide').count()

    def draw_reference(target, character, touch=None):
        points = target.evaluate('''async c=>{
          const glyphs=await (await fetch('./data/glyphs.json')).json();
          const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');document.body.append(svg);
          const strokes=glyphs[c].map(d=>{const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);svg.append(path);const length=path.getTotalLength();return Array.from({length:33},(_,i)=>{const p=path.getPointAtLength(length*i/32);return [p.x,p.y];});});svg.remove();return strokes;
        }''',character)
        target.locator('#challenge-board').scroll_into_view_if_needed()
        box = target.locator('#challenge-board').bounding_box()
        # Account for the 1px border around the SVG viewport.
        def xy(point): return [box['x']+1+point[0]*(box['width']-2)/109,box['y']+1+point[1]*(box['height']-2)/109]
        for stroke in points:
            x,y=xy(stroke[0])
            if touch:
                touch.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
                for point in stroke[1:]:
                    x,y=xy(point);touch.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y}]})
                touch.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
            else:
                target.mouse.move(x,y);target.mouse.down()
                for point in stroke[1:]: target.mouse.move(*xy(point))
                target.mouse.up()

    draw_reference(page,'山')
    expect(page.locator('#answer-ink polyline')).to_have_count(3)
    page.locator('#grade').dblclick()
    expect(page.locator('.result-verdict')).to_contain_text('合格')
    expect(page.locator('.result-verdict')).to_contain_text('金')
    record = page.evaluate("JSON.parse(localStorage.getItem('kanji-challenge-v1')).山")
    assert record['attempts']==1 and record['bestScore']>=95
    page.mouse.move(200,500);page.mouse.down();page.mouse.move(250,550);page.mouse.up()
    expect(page.locator('#answer-ink polyline')).to_have_count(3)
    page.locator('#answer-overlay').uncheck()
    assert not page.locator('#answer-guide').is_visible()
    page.screenshot(path='/tmp/kanji-challenge-result.png',full_page=True)
    page.locator('#challenge-retry').click()
    expect(page.locator('#answer-ink polyline')).to_have_count(0)
    expect(page.locator('#answer-guide path')).to_have_count(0)
    box=page.locator('#challenge-board').bounding_box()
    page.mouse.click(box['x']+70,box['y']+70)
    page.locator('#grade').click()
    expect(page.locator('.result-verdict')).to_contain_text('再挑戦')
    assert page.evaluate("JSON.parse(localStorage.getItem('kanji-challenge-v1')).山.attempts")==2
    assert page.evaluate("JSON.parse(localStorage.getItem('kanji-challenge-v1')).山.bestScore")==record['bestScore']
    page.reload(); page.wait_for_selector('#grade')
    page.goto(URL+'#collection')
    expect(page.locator('.collection-total b')).to_have_text('1')
    expect(page.locator('.collection-tile.gold')).to_have_count(1)
    assert page.evaluate("JSON.parse(localStorage.getItem('kanji-practice-v1'))")==['山']
    page.screenshot(path='/tmp/kanji-collection.png',full_page=True)
    print('Desktop: answer hiding, gold result, duplicate submission guard, locked ink, retry, best score and legacy record preservation passed.',flush=True)

    mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce')
    phone=mobile.new_page();phone.on('pageerror',lambda e:errors.append(str(e)))
    phone.goto(URL+f'#challenge/{mountain}/0');phone.wait_for_selector('#grade')
    client=mobile.new_cdp_session(phone)
    draw_reference(phone,'山',client)
    phone.wait_for_timeout(350)
    phone.locator('#challenge-undo').tap()
    expect(phone.locator('#answer-ink polyline')).to_have_count(2)
    phone.locator('#challenge-erase').tap()
    expect(phone.locator('#answer-ink polyline')).to_have_count(0)
    draw_reference(phone,'山',client);phone.wait_for_timeout(350)
    phone.locator('#grade').tap()
    expect(phone.locator('.result-verdict')).to_contain_text('合格')
    assert phone.locator('.result-score').evaluate("e=>getComputedStyle(e).animationName")=='none'
    for width in [390,320]:
        phone.set_viewport_size({'width':width,'height':844})
        assert phone.evaluate('document.documentElement.scrollWidth <= innerWidth')
    phone.screenshot(path='/tmp/kanji-challenge-mobile.png',full_page=True)
    print('Mobile: real touch input, undo/erase, scoring, reduced motion, 390/320px layout passed.',flush=True)

    # Start a new challenge, cancel a partial touch and navigate away without scoring.
    phone.locator('#challenge-retry').tap()
    phone.locator('#challenge-board').scroll_into_view_if_needed()
    box=phone.locator('#challenge-board').bounding_box();x=box['x']+50;y=box['y']+50
    client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    client.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]})
    expect(phone.locator('#answer-ink polyline')).to_have_count(1)
    expect(phone.locator('#grade')).to_be_disabled()
    phone.wait_for_timeout(350)
    phone.locator('#challenge-undo').tap()
    expect(phone.locator('#answer-ink polyline')).to_have_count(0)
    phone.goto(URL+'#collection')
    assert phone.evaluate("JSON.parse(localStorage.getItem('kanji-challenge-v1')).山.attempts")==1

    complex_word=next(i for i,w in enumerate(words) if '鬱' in w['word'])
    complex_char=list(words[complex_word]['word']).index('鬱')
    phone.goto(URL+f'#challenge/{complex_word}/{complex_char}');phone.wait_for_selector('#grade')
    assert '鬱' not in phone.locator('#app').inner_text()
    draw_reference(phone,'鬱',client);phone.wait_for_timeout(350)
    expect(phone.locator('#answer-ink polyline')).to_have_count(29)
    phone.locator('#grade').tap()
    expect(phone.locator('.result-verdict')).to_contain_text('合格')
    assert phone.evaluate("JSON.parse(localStorage.getItem('kanji-challenge-v1')).鬱.bestScore")>=95
    phone.screenshot(path='/tmp/kanji-challenge-complex-mobile.png',full_page=True)
    print('29-stroke 鬱: actual mobile touch drawing and gold scoring passed.',flush=True)

    blocked=browser.new_context(viewport={'width':390,'height':844})
    blocked.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}})")
    no_storage=blocked.new_page();no_storage.on('pageerror',lambda e:errors.append(str(e)))
    no_storage.goto(URL+f'#challenge/{mountain}/0');no_storage.wait_for_selector('#grade')
    draw_reference(no_storage,'山');no_storage.locator('#grade').click()
    expect(no_storage.locator('.result-card')).to_contain_text('記録を保存できません')
    no_storage.goto(URL+'#collection');expect(no_storage.locator('.collection-total b')).to_have_text('1')
    print('Cancellation, interrupted attempt and blocked-storage fallback passed.',flush=True)
    assert not errors,errors
    browser.close()
