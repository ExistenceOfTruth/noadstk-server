const express = require('express');
const session = require('express-session');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));
const port = 8003;
app.listen(port, async () => {
    console.log(`listening on ${port}`);
});

const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://parhan:sr0Z70ukXlQqkJzL@cluster0.ixj2tbm.mongodb.net/?retryWrites=true&w=majority',
    { useNewUrlParser: true, useUnifiedTopology: true });
const schema = mongoose.Schema;
const views = mongoose.model("views", new schema({
    code: String,
    follow: Array,
    viewed: Array
}));

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

async function isFollow(code, name) {
    return await (await getFollowList(code)).find(x => x.title === name); 
}

async function isCartoon(name) {
    let result = [];
    try {
        result = await cartoonEpisodeList(name);
    }
    catch {
        return undefined;
    }
    return result;
}

function isSave(unique) {
    return pageView.find(x => x.key === unique);
}

async function getFollowList(code) {
    return await views.findOne({ code }).then(res => res.follow);
}

async function getImg(name) {
    const view = await g(`${base}/${name}`);
    const $ = cheerio.load(view);
    return base + $(".bt_thumb").children('a').children('img').attr('src');
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

app.post('/api/code', (req, res) => {
    const code = req.body.code;
    if (code.length == 0) return res.send('n');
    views.findOne({ code }).then(r => {
        if (r == null) {
            new views({
                code,
                follow: [],
                viewed: []
            }).save().then(() => {
                req.session.code = code;
                res.send('done');
            });
        }
        else {
            req.session.code = code;
            res.send('done');
        }
    });
});

app.post('/api/check', (req, res) => {
    res.send(req.session.code === undefined ? '없음' : req.session.code);
});

app.post('/api/search', (req, res) => {
    res.redirect(`/${req.params.name}`);
});

app.post('/api/follow', async(req, res) => {
    console.log('follow');
    if (req.session.code) {
        await views.findOne({ code: req.session.code }).then(async (t) => {
            if (t != null) {
                const img = await getImg(req.body.name);
                await views.updateOne({ code: req.session.code }, { $push: { follow: { title: req.body.name, img } } });
            }
        })
    }
    res.send('done');
});

app.post('/api/unfollow', async(req, res) => {
    console.log('unfollow');
    if (req.session.code) {
        await views.findOneAndUpdate({ code: req.session.code }, { $pull: { follow: { title: req.body.name } } });
    }
    res.send('done');
})

app.get('/', async (req, res) => {


    const code = req.session.code;
    let follow = code ? await getFollowList(code) : [];

    res.render('index.ejs', {
        follow,
        isCode: req.session.code === undefined ? 'flex' : 'none'
    });
});

app.get('/download/all/:cartoon', async (req, res) => {
    const _cartoon = req.params.cartoon;
    if (obj.find(x => x === _cartoon)) {
        const allToons = await cartoonEpisodeList(_cartoon);
        // title, link, epi
        for (let i = 0; i < allToons.length; i++) {
            if (!isSave(`${_cartoon}&${allToons[i].epi}`)) {
                viewed(_cartoon, allToons[i].epi, await cartoon(_cartoon, allToons[i].epi));
            }
        }
        console.log('all downloaded: ' + _cartoon);
        res.redirect(`/${_cartoon}`);
    }
    else {
        res.redirect(`/${_cartoon}`);
    }
});


function checkList(arr) {
    let result = [];
    let tmp;
    for (let i = 0; i < arr.length; i++) {
        //title, link, epi
        tmp = isSave(`${arr[i].title}&${arr[i].epi}`);
        if (tmp) result.push({ title: `${arr[i].title} [✔]`, link: arr[i].link, epi: arr[i].epi });
        else result.push({ title: arr[i].title, link: arr[i].link, epi: arr[i].epi });
    }
    return result;
}
async function checkDB(req) {
    let result = [];
    if (req.session.code) result = await views.findOne({ code: req.session.code }).then(data => data.viewed);
    return result;
}
app.get('/:cartoon/', async (req, res) => {
    try {
        const data = await cartoonEpisodeList(req.params.cartoon);
        
        const db = await checkDB(req);

        const follow = req.session.code ? await isFollow(req.session.code, req.params.cartoon) : false;
        console.log(follow)
        console.log(`rendered: ${req.params.cartoon}`);
        res.render('view.ejs', { data, check: checkList(data), db, follow });
    }
    catch { res.send('false') }
});

app.get('/:cartoon/:epi', async (req, res) => {
    const _cartoon = req.params.cartoon; const epi = req.params.epi;
    try {
        if (req.session.code) {
            views.findOne({ code: req.session.code }).then(async (t) => {
                if (t != null) {
                    if (!t.viewed.find(x => `${x.title}&${x.epi}` === `${_cartoon}&${epi}`)) await views.updateOne({ code: req.session.code }, { $push: { viewed: { title: _cartoon, epi } } });
                }
            })
        }
        const tmp = isSave(`${_cartoon}&${epi}`);
        if (tmp) {
            res.render('cartoon.ejs', { data: tmp.data, list: `/${_cartoon}`, title: `${_cartoon} - ${epi}`, prev: `/${_cartoon}/${Number(epi) - 1}`, after: `/${_cartoon}/${Number(epi) + 1}` });
        }
        else {
            const data = await cartoon(_cartoon, epi);
            if (data == 'last') return res.send('<script>alert("마지막화 입니다.");</script>');
            viewed(_cartoon, epi, data);
            res.render('cartoon.ejs', { data, list: `/${_cartoon}`, title: `${_cartoon} - ${epi}`, prev: `/${_cartoon}/${Number(epi) - 1}`, after: `/${_cartoon}/${Number(epi) + 1}` });
        }
    }
    catch {}
});