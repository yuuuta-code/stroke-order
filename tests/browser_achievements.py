"""Actual scoring flows for medal celebrations, record updates and reduced motion."""
import os
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('APP_URL', 'http://127.0.0.1:4173/')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1280,'height':1000})
    errors = []
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(URL);page.wait_for_selector('.word-card')
    word_index=page.evaluate("fetch('./data/words.json').then(r=>r.json()).then(words=>words.findIndex(w=>w.word.startsWith('山')))")
    target=URL+f'#challenge/{word_index}/0'
    reference=page.evaluate('''async()=>{
      const glyphs=await(await fetch('./data/glyphs.json')).json();
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');document.body.append(svg);
      const strokes=glyphs['山'].map(d=>{const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);svg.append(path);const length=path.getTotalLength();return Array.from({length:33},(_,i)=>{const p=path.getPointAtLength(length*i/32);return [p.x,p.y];});});svg.remove();return strokes;
    }''')
    def draw(offset):
        page.locator('#challenge-board').scroll_into_view_if_needed()
        box=page.locator('#challenge-board').bounding_box()
        def xy(point):return [box['x']+1+(point[0]+offset)*(box['width']-2)/109,box['y']+1+point[1]*(box['height']-2)/109]
        for stroke in reference:
            page.mouse.move(*xy(stroke[0]));page.mouse.down()
            for point in stroke[1:]:page.mouse.move(*xy(point))
            page.mouse.up()
        page.locator('#grade').click()

    for offset,rank in [(5,'bronze'),(3,'silver'),(0,'gold')]:
        page.goto(target);page.wait_for_selector('#grade');draw(offset)
        expect(page.locator(f'.achievement-celebration.{rank}')).to_be_visible()
        expect(page.locator('.achievement-celebration')).to_have_count(1)
        record=page.evaluate("JSON.parse(localStorage.getItem('kanji-challenge-v1')).山")
        expect(page.locator('.score-number')).to_have_text(str(record['bestScore']))
        assert record['bestRank']==rank
        if rank=='bronze':expect(page.locator('.personal-best-celebration')).to_have_count(0)
        else:expect(page.locator('.personal-best-celebration')).to_be_visible()
        # Capture the awarded seal after the entrance without infinite decorative motion.
        page.screenshot(path=f'/tmp/kanji-award-{rank}.png',full_page=True)
        page.wait_for_function("[...document.querySelector('.result-card').getAnimations({subtree:true})].every(a=>a.playState !== 'running')",timeout=5000)
        page.locator('#challenge-retry').click()
    print('Real scores award bronze, silver and gold; only genuine record improvements show the vermilion seal.',flush=True)

    draw(0)
    expect(page.locator('.achievement-celebration.gold')).to_be_visible()
    expect(page.locator('.personal-best-celebration')).to_have_count(0)
    page.locator('#challenge-retry').click()
    # First score is not a previous personal best. A later improvement can be celebrated even below a pass.
    page.evaluate("localStorage.setItem('kanji-challenge-v1',JSON.stringify({山:{bestScore:40,bestRank:'none',attempts:1}}))")
    page.reload();page.wait_for_selector('#grade');draw(14)
    expect(page.locator('.achievement-celebration')).to_have_count(0)
    expect(page.locator('.personal-best-celebration')).to_be_visible()
    expect(page.locator('.result-verdict')).to_contain_text('未合格')
    best=page.evaluate("JSON.parse(localStorage.getItem('kanji-challenge-v1')).山.bestScore")
    expect(page.locator('.score-number')).to_have_text(str(best))
    page.screenshot(path='/tmp/kanji-award-personal-best.png',full_page=True)
    print('Ties do not show a new record; below-pass improvements show a record without awarding a medal.',flush=True)

    page.emulate_media(reduced_motion='reduce')
    page.set_viewport_size({'width':320,'height':844})
    page.evaluate("localStorage.removeItem('kanji-challenge-v1')")
    page.reload();page.wait_for_selector('#grade');draw(0)
    expect(page.locator('.score-number')).to_have_text('100')
    expect(page.locator('.achievement-celebration.gold')).to_be_visible()
    animations=page.locator('.result-card').evaluate("e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length")
    assert animations==0
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path='/tmp/kanji-award-mobile-reduced.png',full_page=True)
    page.locator('#challenge-retry').click()
    expect(page.locator('.achievement-celebration')).to_have_count(0)
    page.emulate_media(reduced_motion='no-preference')
    draw(0)
    assert page.locator('.result-card').evaluate("e=>e.getAnimations({subtree:true}).some(a=>a.playState==='running')")
    page.emulate_media(reduced_motion='reduce')
    expect(page.locator('.score-number')).to_have_text('100')
    assert page.locator('.result-card').evaluate("e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length")==0
    page.goto(URL+'#collection')
    expect(page.locator('.collection-tile.gold')).to_have_count(1)
    assert not errors,errors
    print('320px layout, reduced motion (including live preference change), replay and navigation cleanup passed.',flush=True)
    browser.close()
