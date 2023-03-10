const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const port = 8003;
app.listen(port, async () => {
    console.log(`listening on ${port}`);
    customInterval(43200, async () => mainData = await cartoonImgList());

});

const obj = ['무신귀환록', '사신표월', '무한의 마법사', '저 그런 인재 아닙니다', '검술명가 막내아들', '구천구검'];
const base = 'https://toonkor193.com';

async function g(uri) {
    return await axios.get(uri).then(res => res.data);
}

const customInterval = (sec, callback) => {
    callback();
    return setInterval(callback, sec * 1000);
}

//simillar redis
let mainData, pageView = [];
function viewed(name, epi, data) {
    if (epi === 'last') return;
    console.log(`pass: ${name} ${epi}`)
    pageView.push({ key: `${name}&${epi}`, data });
}

async function cartoonImgList() {
    let result = [];
    let view, $;
    for (let i = 0; i < obj.length; i++) {
        view = await g(`${base}/${obj[i]}`);
        $ = cheerio.load(view);
        const lastEpi = $('.bt_view2').find('.bt_data:last-child').text().trim().split(' ')[1].replace('화', '');
        result.push({ name: obj[i], lastEpi, img: base + $('.bt_thumb').children('a').children('img').attr('src') });
    }
    return result;
}

async function cartoonEpisodeList(toonName) {
    let result = [];

    const view = await g(`${base}/${toonName}`);
    const $ = cheerio.load(view);
    const ff = $("#bo_list").find('.content__title');
    ff.each((i, e) => {
        const title = toonName;
        const link = base + $(e).attr('data-role');
        const epi = $(e).text().trim().split(' ').pop().replace('화', '').includes(')') ? $(e).text().trim().split(' ').pop().replace('화', '').replace(')', '') : $(e).text().trim().split(' ').pop().replace('화', '');
        result.push({ title, link, epi });
    });
    return result;
}

async function cartoon(toonName, epi) {
    const data = await cartoonEpisodeList(toonName);
    const filter = data.find(x => x.epi === epi);

    let view, $;

    try {
        view = await g(`${filter.link}`);
        $ = cheerio.load(view);
    }
    catch {
        return 'last';
    }

    function replaceAll(str, searchStr, replaceStr) {
        return str.split(searchStr).join(replaceStr);
    }

    const text = $($('script')).text();
    const findAndClean = findTextAndReturnRemainder(text, "var toon_img =");
    const result = replaceAll(replaceAll(findAndClean, "'", ''), ' ', '');

    return result;
}

function findTextAndReturnRemainder(target, variable) {
    var chopFront = target.substring(target.search(variable) + variable.length, target.length);
    var result = chopFront.substring(0, chopFront.search(";"));
    return result;
}

app.get('/', async (req, res) => {
    res.render('index.ejs', { data: mainData });
});

app.get('/:cartoon/', async (req, res) => {
    if (obj.find(x => x === req.params.cartoon)) {
        const data = await cartoonEpisodeList(req.params.cartoon);
        res.render('view.ejs', { data });
    }
    else {
        res.send('false');
    }
});

app.get('/:cartoon/:epi', async (req, res) => {
    const cartoon = req.params.cartoon; const epi = req.params.epi;

    if (obj.find(x => x === cartoon)) {
        const tmp = pageView.find(y => y.key === `${cartoon}&${epi}`);
        if (tmp) {
            res.render('cartoon.ejs', { data: tmp.data, list: `/${cartoon}`, title: `${cartoon} - ${epi}`, prev: `/${cartoon}/${Number(epi) - 1}`, after: `/${cartoon}/${Number(epi) + 1}` });
        }
        else {
            const data = await cartoon(cartoon, epi);
            if (data == 'last') return res.send('<script>alert("마지막화 입니다.");</script>');
            viewed(cartoon, epi, data);
            res.render('cartoon.ejs', { data, list: `/${cartoon}`, title: `${cartoon} - ${epi}`, prev: `/${cartoon}/${Number(epi) - 1}`, after: `/${cartoon}/${Number(epi) + 1}` });
        }
    }
    else {
        res.redirect(`/`);
    }
});