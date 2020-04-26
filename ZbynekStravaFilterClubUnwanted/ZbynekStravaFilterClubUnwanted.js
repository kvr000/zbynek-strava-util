// ==UserScript==
// @id          https://github.com/kvr000/zbynek-strava-util/ZbynekStravaFilterClubUnwanted/
// @name        Zbynek Strava Filter Club Unwanted
// @namespace   https://github.com/kvr000/zbynek-strava-util/
// @description Strava - filter unwanted members from club activities
// @author      Zbynek Vyskovsky, kvr000@gmail.com https://github.com/kvr000/
// @copyright   2020+, Zbynek Vyskovsky,kvr000@gmail.com (https://github.com/kvr000/zbynek-strava-util/)
// @license     Apache-2.0
// @homepage    https://github.com/kvr000/zbynek-strava-util/
// @homepageURL https://github.com/kvr000/zbynek-strava-util/
// @downloadURL https://github.com/kvr000/zbynek-strava-util/ZbynekStravaFilterClubUnwanted/ZbynekStravaFilterClubUnwanted.js
// @updateURL   https://raw.githubusercontent.com/kvr000/zbynek-strava-util/master/ZbynekStravaFilterClubUnwanted/ZbynekStravaFilterClubUnwanted.js
// @supportURL  https://raw.githubusercontent.com/kvr000/zbynek-strava-util/master/ZbynekStravaFilterClubUnwanted/ZbynekStravaFilterClubUnwanted.js
// @contributionURL https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=J778VRUGJRZRG&item_name=Support+features+development.&currency_code=CAD&source=url
// @version     0.0.1
// @grant       GM_addStyle
// @include     https://www.strava.com/clubs/*/recent_activity
// @include     http://www.strava.com/clubs/*/recent_activity
// @include     https://strava.com/clubs/*/recent_activity
// @include     http://strava.com/clubs/*/recent_activity
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js
// @run-at      document-idle
// ==/UserScript==

/*jshint loopfunc:true */

window.addEventListener('load', function() {
	'use strict';
	let $ = window.jQuery;

	let unwanted;
	try {
		unwanted = JSON.parse(window.localStorage.getItem('ZbynekStravaClubFilterUnwanted.unwantedAthletes')) || {};
	}
	catch (err) {
		console.log(err);
		unwanted = {};
	}

	function needXpath(doc, xpath, start)
	{
		let node;
		if ((node = doc.evaluate(xpath, start, null, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue) != null) {
			return node;
		}
		throw new Error("Cannot find node: " + xpath);
	}

	function listXpath(doc, xpath, start)
	{
		let elements = [];
		for (let xpathOut = doc.evaluate(xpath, start), el = null; (el = xpathOut.iterateNext()); ) {
			elements.push(el);
		}
		return elements;
	}

	function removeXpath(doc, xpath, start)
	{
		let node;
		if ((node = doc.evaluate(xpath, start, null, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue) != null) {
			node.remove();
		}
	}

	function createElementEx(doc, name, attrs, children)
	{
		let element = doc.createElement(name);
		if (attrs) {
			$.each(attrs, function (k, v) { if (k === 'class') element.setAttribute(k, v); else element[k] = v; });
		}
		if (children) {
			if (!$.isArray(children)) { throw new Error("Passed non-array as children object: "+children); }
			$.each(children, function (k, v) { element.appendChild(v); });
		}
		return element;
	}

	function initializeUi()
	{
		GM_addStyle(
			".zbynek-strava-club-filter-unwanted-menu { position: absolute; display: inline-block }\n"+
			".zbynek-strava-club-filter-unwanted-menu .items { display: none; position: absolute; padding: 12px 16px; background-color: #ffcccc }"+
			".zbynek-strava-club-filter-unwanted-menu:hover .items { display: block; }"
		);
	}

	function processUnwantedAthletes()
	{
		let activities = listXpath(document, "//div[contains(concat(' ', @class, ' '), ' feed ')]//div[contains(concat(' ', @class, ' '), ' activity ') and contains(concat(' ', @class, ' '), ' feed-entry ')]", document);
		$.each(activities, function (i, activityEl) {
			try {
				let athleteId = document.evaluate(".//a[@id = 'zbynek-strava-club-filter-unwanted-hide']", activityEl, null, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue.athleteId;
					let hide = unwanted[athleteId];
				if (hide === true) {
					activityEl.style.display = 'none';
				}
				else {
					activityEl.style.display = 'block';
				}
			}
			catch (err) {
				console.log(err);
			}
		});
	}

	function hideUnwantedAthlete(athleteId)
	{
		unwanted[athleteId] = true;
		window.localStorage.setItem('ZbynekStravaClubFilterUnwanted.unwantedAthletes', JSON.stringify(unwanted));
		processUnwantedAthletes();
	}

	function updateFeed()
	{
		let tabsEl = needXpath(document, "//div[@class = 'spans11']/ul[@class = 'tabs']", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE);
		removeXpath(document, "./li[div[@class = 'zbynek-strava-club-filter-unwanted-tab-menu']]", tabsEl);
		tabsEl.appendChild(
			createElementEx(document, "li", null, [
				createElementEx(document, "div", { class: 'zbynek-strava-club-filter-unwanted-menu tab' }, [
					document.createTextNode("Unwanted members"),
					createElementEx(document, "ul", { class: 'items' }, [
						createElementEx(document, "li", { onclick: updateFeed }, [ document.createTextNode('Refresh') ]),
						createElementEx(document, "li", { onclick: function() { unwanted = {}; hideUnwantedAthlete(""); } }, [ document.createTextNode('Reset') ]),
						createElementEx(document, "li", null, [
							createElementEx(document, "a", { href: "https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=J778VRUGJRZRG&item_name=Support+features+development.&currency_code=CAD&source=url", target: "_blank" }, [ document.createTextNode('Donate and support development') ])
						]),
					])
				])
			])
		);

		let activities = listXpath(document, "//div[contains(concat(' ', @class, ' '), ' feed ')]//div[contains(concat(' ', @class, ' '), ' activity ') and contains(concat(' ', @class, ' '), ' feed-entry ')]", document);
		$.each(activities, function (i, activityEl) {
			try {
				let athleteId = document.evaluate("substring-after(.//a[contains(concat(' ', @class, ' '), ' entry-athlete ')]/@href, '/athletes/')", activityEl, null, XPathResult.STRING_TYPE).stringValue;
				let menuEl = createElementEx(document, "div", { style: "float: right;", id: 'zbynek-strava-club-filter-unwanted-menu' }, [
					createElementEx(document, "a", { athleteId: athleteId, id: 'zbynek-strava-club-filter-unwanted-hide', onclick: function() { hideUnwantedAthlete(athleteId); } }, [
						document.createTextNode("Filter out athlete")
					]),
				]);
				removeXpath(document, ".//div[@id = 'zbynek-strava-club-filter-unwanted-menu']", activityEl);
				document.evaluate(".//div[contains(concat(' ', @class, ' '), ' entry-head ')]", activityEl, null, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue.appendChild(menuEl);
			}
			catch (err) {
				console.log(err);
			}
		});
		processUnwantedAthletes();
	}

	function setupListener()
	{
		let feedEl = needXpath(document, "//div[@class = 'spans11']//div[contains(concat(' ', @class, ' '), ' feed-moby ')]", document);
		new MutationObserver(updateFeed).observe(feedEl, { attributes: false, childList: true, subtree: false });
	}

	initializeUi();

	updateFeed();
	setupListener();

}, false);
