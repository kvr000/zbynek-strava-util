// ==UserScript==
// @id          https://github.com/kvr000/zbynek-strava-util/ZbynekStravaSegmentInfo/
// @name        ZbynekStravaSegmentInfo
// @namespace   https://github.com/kvr000/zbynek-strava-util/
// @description Strava - Enhance segment matcher with detailed segment information.
// @author      Zbynek Vyskovsky, kvr000@gmail.com https://github.com/kvr000/
// @copyright   2020+, Zbynek Vyskovsky,kvr000@gmail.com (https://github.com/kvr000/zbynek-strava-util/)
// @license     Apache-2.0
// @homepage    https://github.com/kvr000/zbynek-strava-util/
// @homepageURL https://github.com/kvr000/zbynek-strava-util/
// @downloadURL https://raw.githubusercontent.com/kvr000/zbynek-strava-util/master/ZbynekStravaSegmentInfo/ZbynekStravaSegmentInfo.js
// @updateURL   https://raw.githubusercontent.com/kvr000/zbynek-strava-util/master/ZbynekStravaSegmentInfo/ZbynekStravaSegmentInfo.js
// @supportURL  https://github.com/kvr000/zbynek-strava-util/issues/
// @contributionURL https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=J778VRUGJRZRG&item_name=Support+features+development.&currency_code=CAD&source=url
// @version     0.0.1
// @grant       none
// @include     https://www.strava.com/activities/*/potential-segment-matches
// @include     http://www.strava.com/activities/*/potential-segment-matches
// @include     https://strava.com/activities/*/potential-segment-matches
// @include     http://strava.com/activities/*/potential-segment-matches
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js
// @run-at      document-idle
// ==/UserScript==
/*jshint loopfunc:true */

window.addEventListener('load', function() {
	'use strict';
	let $ = jQuery.noConflict(true);

	function needXpathNode(doc, xpath, start)
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
			$.each(attrs, function (k, v) { element[k] = v; });
		}
		if (children) {
			if (!$.isArray(children)) { throw new Error("Passed non-array as children object: "+children); }
			$.each(children, function (k, v) { element.appendChild(v); });
		}
		return element;
	}

	function enrichSegments() {
		let a = 0;
		let segments = listXpath(document, "//*[@id='segment-visualizer']//ul[contains(concat(' ', @class, ' '), ' list-segments ')]/li[contains(concat(' ', @class, ' '), ' segment-row ')]", document);
		for (let segmentIdx in segments) {
			let segmentRow = segments[segmentIdx];
			let segmentId = segmentRow.getAttribute("data-segment-id");
			jQuery.get(
				"https://www.strava.com/segments/"+segmentId,
				null,
				(data) => {
					let html = new DOMParser().parseFromString(data, 'text/html')
					let distance = html.evaluate("//div[contains(@class, 'segment-heading')]//div[@class='stat' and span[@class='stat-subtext' and text() = 'Distance']]/*[@class='stat-text']/text()", html, null, XPathResult.STRING_TYPE, null).stringValue;
					let avgGrade = html.evaluate("//div[contains(@class, 'segment-heading')]//div[@class='stat' and span[@class='stat-subtext' and text() = 'Avg Grade']]/*[@class='stat-text']/text()", html, null, XPathResult.STRING_TYPE, null).stringValue;
					let bestTime = html.evaluate("//div[@id='results']//td[@class='last-child']/text()", html, null, XPathResult.STRING_TYPE, null).stringValue;
					let bestSpeed = html.evaluate("//div[@id='results']//td[abbr[text() = 'km/h']]/text()", html, null, XPathResult.STRING_TYPE, null).stringValue;
					console.log(segmentId, segmentRow, distance, avgGrade, bestSpeed, bestTime);
					let spanEl = document.createElement("span"); spanEl.setAttribute("style", "float: right;"); spanEl.setAttribute("id", "zbynek-segment-data");
					let linkEl = document.createElement("a"); linkEl.setAttribute("href", "https://www.strava.com/segments/"+segmentId); linkEl.setAttribute("target", "_blank");
					spanEl.appendChild(linkEl);
					linkEl.appendChild(document.createTextNode(distance + " km, " + avgGrade + "%, " + bestTime + " s, "+ bestSpeed + " km/h"));
					let old = document.evaluate("./span[@id='zbynek-segment-data']", segmentRow, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
					if (old && old.singleNodeValue != null) old.singleNodeValue.remove();
					segmentRow.appendChild(spanEl);
				},
				"html"
			);
			if (++a >= 1000000) break;
		}
		console.log("Segments processed "+a);
	}

	function initializeMenu()
	{
		let sidenavEl = needXpathNode(document, "//*[contains(concat(' ', @class, ' '), ' sidenav ')]/ul[@id = 'pagenav']", document);
		let evaluateEl = createElementEx(document, "li", null, [
			createElementEx(document, "ul", null, [
				createElementEx(document, "li", null, [ document.createTextNode("Zbynek Info Segments") ]),
				createElementEx(document, "li", null, [
					createElementEx(document, "a", { onclick: function() { enrichSegments(); } }, [ document.createTextNode("Info Segments") ])
				]),
				createElementEx(document, "li", null, [
					createElementEx(document, "a", { href: "https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=J778VRUGJRZRG&item_name=Support+features+development.&currency_code=CAD&source=url", target: "_blank" }, [ document.createTextNode("Support features development") ])
				]),
			])
		]);
		sidenavEl.appendChild(evaluateEl);
	}

	initializeMenu();

}, false);
