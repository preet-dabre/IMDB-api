const fetch = require('node-fetch');
const cheerio = require('cheerio');

// const movieName = 'Star wars';
// const url = `https://www.imdb.com/find?ref_=nv_sr_fn&q=${movieName}&s=tt`;

const makeSearchUrl = (movie) => {
    return `https://www.imdb.com/find?ref_=nv_sr_fn&q=${movie}&s=tt`;
}

const makeMovieUrl = (imdbID) => {
    return `https://www.imdb.com/title/${imdbID}/?ref_=fn_tt_tt_1`;
}


const movieCache = [];
const searchCache = [];


function searchMovies(searchTerm) {
    if(searchCache[searchTerm]) {
        console.log('Serving from cache', searchTerm);
        return Promise.resolve(searchCache[searchTerm]);
    }
    return fetch(makeSearchUrl(searchTerm))
        .then(response => response.text())
        .then(body => {
            const movies = [];
            const $ = cheerio.load(body);
            $('.findResult').each(function (i, element) {
                const $element = $(element);
                const $image = $element.find('td a img');
                const $title = $element.find('td.result_text a');

                const imdbID = $title.attr('href').match(/title\/(.*)\//)[1];

                const movie = {
                    image: $image.attr('src'),
                    title: $title.text(),
                    imdbID
                };
                movies.push(movie);
            });

            searchCache[searchTerm] = movies;
            return movies;
        });
}


function getMovie(imdbID) {
    if (movieCache[imdbID]) {
        console.log('Serving from cache', imdbID);
        return Promise.resolve(movieCache[imdbID]);
    }
    return fetch(makeMovieUrl(imdbID))
        .then(response => response.text())
        .then(body => {
            const $ = cheerio.load(body);
            const title = $('.title_wrapper h1').first().contents().filter(function() {
                return this.type === 'text';
            }).text().trim();
            const year = $('#titleYear a').text();
            const subtext = $('.subtext').text();
            const subtexts = subtext.split("|").map((subtext) => {
                return subtext.trim();
            });
            const poster = $('div.poster a img').attr('src');

            const imdbRating = $('span[itemprop="ratingValue"]').text();
            const plot = $('div.summary_text').text().trim();
            const directors = [];
            const writers = [];
            const stars = [];

            function getItems(itemArray) {
                return function (i, element) {
                    itemArray.push($(element).text());
                }
            }
            $('div.credit_summary_item').each(function (i, element) {
                const category = $(element).children('h4').text();
                if (category === 'Director:' || category === 'Directors:') {
                    $(element).children('a').each(getItems(directors));
                }
                else if (category === 'Writer:' || category === 'Writers:') {
                    $(element).children('a').each(getItems(writers));
                }
                else if (category === 'Stars:') {
                    $(element).children('a').each(function (i, element) {
                        if ($(element).text() != 'See full cast & crew')
                        stars.push($(element).text());
                    });
                }
            });

            const storyline = $('#titleStoryLine div p span').text();
            const budget = $($('h3.subheading')[0]).next().text().split(":");
            const productionBanner = Array.from($('h4.inline')).filter((element) => {
                return $(element).text() === 'Production Co:'
            });

            const productionCo = [];
            $(productionBanner).parent().children('a').each(getItems(productionCo));

            const trailer = 'https://www.imdb.com/videoplayer/' +
                            ($('div.slate a').attr('href')).match(/video\/imdb\/(.*)/)[1];
            const movie = {
                imdbID,
                title,
                year,
                rating: subtexts[0],
                runTime: subtexts[1],
                genres: subtexts[2].split(','),
                release: subtexts[3],
                imdbRating,
                poster,
                plot,
                directors,
                writers,
                stars,
                storyline,
                budget: budget[1],
                productionCo,
                trailer
            };

            movieCache[imdbID] = movie;
            return movie;
        });
}

module.exports = {searchMovies, getMovie};
