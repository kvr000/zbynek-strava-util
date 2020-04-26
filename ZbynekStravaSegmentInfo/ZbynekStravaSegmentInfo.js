// ==UserScript==
// @id          https://github.com/kvr000/zbynek-strava-util/ZbynekStravaSegmentInfo/
// @name        Zbynek Strava Segment Info
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
// @version     0.0.2
// @include     https://www.strava.com/activities/*/potential-segment-matches
// @include     http://www.strava.com/activities/*/potential-segment-matches
// @include     https://strava.com/activities/*/potential-segment-matches
// @include     http://strava.com/activities/*/potential-segment-matches
// @grant       GM_log
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// @grant       GM_getClipboard
// @grant       GM_setClipboard
// @run-at      document-idle
// ==/UserScript==
/*jshint loopfunc:true */

window.addEventListener('load', function() {
	'use strict';
	let $ = unsafeWindow.jQuery;

	let PR_MATCH = /^\s*\u21b5?\s*((\d+:)*\d+)\s*\u21b5?\s*$/;

	class HtmlWrapper
	{
		constructor(doc)
		{
			this.doc = doc;
		}

		needXpathNode(xpath, start)
		{
			let node;
			if ((node = this.doc.evaluate(xpath, start, null, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue) != null) {
				return node;
			}
			throw new Error("Cannot find node: " + xpath);
		}

		listXpath(xpath, start)
		{
			let elements = [];
			for (let xpathOut = this.doc.evaluate(xpath, start), el = null; (el = xpathOut.iterateNext()); ) {
				elements.push(el);
			}
			return elements;
		}

		removeXpath(xpath, start)
		{
			let node;
			if ((node = this.doc.evaluate(xpath, start, null, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue) != null) {
				node.remove();
			}
		}

		createElementEx(name, attrs, children)
		{
			let element = this.doc.createElement(name);
			if (attrs) {
				Object.getOwnPropertyNames(attrs).forEach((k) => { let v = attrs[k]; if (k === 'class') element.setAttribute(k, v); else element[k] = v; });
			}
			if (children) {
				if (!Array.isArray(children)) { throw new Error("Passed non-array as children object: "+children); }
				children.forEach(v => element.appendChild(v));
			}
			return element;
		}

		createElementWithText(name, attrs, text)
		{
			return this.createElementEx(name, attrs, [
				this.createTextNode(text)
			]);
		}

		createTextNode(text)
		{
			return this.doc.createTextNode(text);
		}

	}

	class LocalStorageCache
	{
		constructor(storage, name, version, expiration)
		{
			this.storage = storage;
			this.name = name;
			this.expiration = expiration;
			this.pendingWrite = false;
			this.version = version;
			try {
				this.cache = JSON.parse(this.storage.getItem(this.name));
			}
			catch (err) {
			}
			if (!this.cache) {
				this.cache = {};
			}
		}

		get(id)
		{
			let item = this.cache[id];
			if (item) {
				if (item.version == this.version && (item.expire == null || item.expire > new Date().getTime())) {
					return item.value;
				}
				delete this.cache[id];
				this.scheduleUpdate();
			}
			return null;
		}

		put(id, value)
		{
			this.cache[id] = { expire: this.expiration == null ? null : new Date().getTime()+this.expiration, version: this.version, value: value };
			this.scheduleUpdate();
		}

		scheduleUpdate()
		{
			if (!this.pendingWrite) {
				setTimeout(() => this.doUpdate(), 5000);
				this.pendingWrite = false;
			}
		}

		doUpdate()
		{
			this.storage.setItem(this.name, JSON.stringify(this.cache));
			this.pendingWrite = false;
		}
	}

	let segmentCache;

	let dwrapper = new HtmlWrapper(document);

	function enrichSegments()
	{
		let a = 0;
		let segments = dwrapper.listXpath("//*[@id='segment-visualizer']//ul[contains(concat(' ', @class, ' '), ' list-segments ')]/li[contains(concat(' ', @class, ' '), ' segment-row ')]", document);
		for (let segmentIdx in segments) {
			let segmentRow = segments[segmentIdx];
			let segmentId = segmentRow.getAttribute("data-segment-id");
			let updator = (segmentInfo) => {
				segmentCache.put(segmentId, segmentInfo);
			};
			let completor = (segmentInfo) => {
				let old = document.evaluate("./span[@id='zbynek-strava-info-segment']", segmentRow, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
				if (old && old.singleNodeValue != null) old.singleNodeValue.remove();
				let infoEl = dwrapper.createElementEx("span", { class: "zbynek-strava-info-segment", id: "zbynek-strava-info-segment", onchange: () => {} }, [
					dwrapper.createElementWithText("span", { class: "distance" }, segmentInfo.info.distance_str+"km"),
					dwrapper.createElementWithText("span", { class: "grade" }, segmentInfo.info.avgGrade_str+"%"),
					dwrapper.createElementWithText("span", { class: "elevationGain" }, segmentInfo.info.elevationGain.toFixed(0)+"m"),
					dwrapper.createElementEx("span", { class: "prTime" }, [
						dwrapper.createElementWithText("a", { href: segmentInfo.pr.link, target: "_blank" }, (segmentInfo.pr.time_str||"")+"s")
					]),
					dwrapper.createElementWithText("span", { class: "prKqomIndicator" }, (segmentInfo.pr.link && (segmentInfo.pr.link == segmentInfo.kom.link || segmentInfo.pr.link == segmentInfo.qom.link) ? " prItIsKqom" : "") ? "\uD83D\uDC51" : ""),
					dwrapper.createElementEx("span", { class: "kqomTime" }, [
						dwrapper.createElementWithText("a", { href: segmentInfo.kom.link, target: "_blank" }, (segmentInfo.best.time_str||"")+"s")
					]),
					dwrapper.createElementWithText("span", { class: "kqomSpeed" }, segmentInfo.best.speed_str+"km/h"),
					dwrapper.createElementWithText("span", { class: "kqomPower" }, segmentInfo.best.power_str+"W"),
					dwrapper.createElementEx("span", { class: "link" }, [
						dwrapper.createElementEx("a", { href: "https://www.strava.com/segments/"+segmentId, target: "_blank" }, [
							dwrapper.createTextNode("\uD83D\uDD17")
						])
					]),
				]);
				segmentRow.appendChild(infoEl);
			};
			let cachedInfo = segmentCache.get(segmentId);
			if (cachedInfo) {
				completor(cachedInfo);
			}
			else {
				GM_xmlhttpRequest({
					method: "GET",
					url: "/segments/"+segmentId,
					onload: (response) => {
						let html = new DOMParser().parseFromString(response.responseText, 'text/html')
						let distance = html.evaluate("//div[contains(@class, 'segment-heading')]//div[@class='stat' and span[@class='stat-subtext' and text() = 'Distance']]/*[@class='stat-text']/text()", html, null, XPathResult.STRING_TYPE, null).stringValue;
						let elevation = html.evaluate("//div[contains(@class, 'segment-heading')]//div[@class='stat' and span[@class='stat-subtext' and text() = 'Elev Difference']]/*[@class='stat-text']/text()", html, null, XPathResult.STRING_TYPE, null).stringValue;
						let avgGrade = html.evaluate("//div[contains(@class, 'segment-heading')]//div[@class='stat' and span[@class='stat-subtext' and text() = 'Avg Grade']]/*[@class='stat-text']/text()", html, null, XPathResult.STRING_TYPE, null).stringValue;
						let prTime = html.evaluate("//div[contains(concat(' ', @class, ' '), ' result ') and @data-tracking-element = 'pr_effort']/strong[contains(text(), 'All-Time PR')]/following-sibling::text()", html, null, XPathResult.STRING_TYPE).stringValue.match(PR_MATCH)?.[1];
						let prLink = html.evaluate("//div[contains(concat(' ', @class, ' '), ' result ') and @data-tracking-element = 'pr_effort']/span[contains(concat(' ', @class, ' '), ' timestamp ')]/a/@href", html, null, XPathResult.STRING_TYPE).stringValue;
						let komTime = html.evaluate("//div[contains(concat(' ', @class, ' '), ' result ') and @data-tracking-element = 'kom_effort']/strong[contains(text(), 'KOM')]/following-sibling::text()", html, null, XPathResult.STRING_TYPE).stringValue.match(PR_MATCH)?.[1];
						let komLink = html.evaluate("//div[contains(concat(' ', @class, ' '), ' result ') and @data-tracking-element = 'kom_effort']/span[contains(concat(' ', @class, ' '), ' timestamp ')]/a/@href", html, null, XPathResult.STRING_TYPE).stringValue;
						let qomTime = html.evaluate("//div[contains(concat(' ', @class, ' '), ' result ') and @data-tracking-element = 'qom_effort']/strong[contains(text(), 'KOM')]/following-sibling::text()", html, null, XPathResult.STRING_TYPE).stringValue.match(PR_MATCH)?.[1];
						let qomLink = html.evaluate("//div[contains(concat(' ', @class, ' '), ' result ') and @data-tracking-element = 'qom_effort']/span[contains(concat(' ', @class, ' '), ' timestamp ')]/a/@href", html, null, XPathResult.STRING_TYPE).stringValue;
						let bestTime = html.evaluate("//table[contains(concat(' ', @class, ' '), 'table-leaderboard')]/tbody/tr[1]/td[@class='last-child']/text()", html, null, XPathResult.STRING_TYPE, null).stringValue;
						let bestSpeed = html.evaluate("//table[contains(concat(' ', @class, ' '), 'table-leaderboard')]/tbody/tr[1]/td[abbr[text() = 'km/h']]/text()", html, null, XPathResult.STRING_TYPE, null).stringValue;
						let bestBpm = html.evaluate("//table[contains(concat(' ', @class, ' '), 'table-leaderboard')]/tbody/tr[1]/td[abbr[text() = 'bpm']]/text()", html, null, XPathResult.STRING_TYPE, null).stringValue;
						let bestPower = html.evaluate("//table[contains(concat(' ', @class, ' '), 'table-leaderboard')]/tbody/tr[1]/td[abbr[text() = 'W']]/text()", html, null, XPathResult.STRING_TYPE, null).stringValue;
						let bestVam = html.evaluate("//table[contains(concat(' ', @class, ' '), 'table-leaderboard')]/tbody/tr[1]/td[@class='last-child']/preceding-sibling::td[1]/text()", html, null, XPathResult.STRING_TYPE, null).stringValue;
						GM_xmlhttpRequest({
							method: "GET",
							url: "/stream/segments/"+segmentId+"?streams%5B%5D=altitude",
							onload: (response) => {
								let route = JSON.parse(response.responseText);
								let elevationGain = route.altitude.reduce((total, current, index, array) => total+(index == 0 ? 0 : Math.max(0, current-array[index-1])), 0);
								let segmentInfo = {
									info: {
										id: segmentId,
										distance_str: distance,
										elevation_str: elevation,
										avgGrade_str: avgGrade,
										elevationGain: elevationGain,
									},
									pr: {
										time_str: prTime,
										link: prLink,
									},
									kom: {
										time_str: komTime,
										link: komLink,
									},
									qom: {
										time_str: qomTime,
										link: qomLink,
									},
									best: {
										time_str: bestTime,
										speed_str: bestSpeed,
										heartRate_str: bestBpm,
										power_str: bestPower,
										vam_str: bestVam,
									},
								};
								segmentCache.put(segmentId, segmentInfo);
								console.log(segmentInfo);
								updator(segmentInfo);
								completor(segmentInfo);
							}
						});
					}
				});
			}
			if (++a >= 1000000) break;
		}
		console.log("Segments processed "+a);
	}

	function importDb()
	{
	}

	function exportDb()
	{
	}

	function initializeData()
	{
		segmentCache = new LocalStorageCache(window.localStorage, "ZbynekStravaSegmentInfo.segmentData", 1, 10*86400*1000);
	}

	function initializeUi()
	{
		let style =
			".zbynek-strava-inline-select { appearance: none; border: none; }\n"+
			".zbynek-strava-info-segment { display: block; }\n"+
			".zbynek-strava-info-segment > span { display: inline-block; text-align: right; padding-left: 0px; padding-right: 0px; font-weight: normal; }\n"+
			".zbynek-strava-info-segment > .distance { width: 14%; text-align: right; }\n"+
			".zbynek-strava-info-segment > .grade { width: 10%; text-align: right; }\n"+
			".zbynek-strava-info-segment > .elevationGain { width: 10%; text-align: right; }\n"+
			".zbynek-strava-info-segment > .prTime { width: 11%; text-align: right; }\n"+
			".zbynek-strava-info-segment > .prKqomIndicator { width: 7%; text-align: right; }\n"+
			".zbynek-strava-info-segment > .kqomTime { width: 11%; text-align: right; }\n"+
			".zbynek-strava-info-segment > .kqomSpeed { width: 17%; text-align: right; }\n"+
			".zbynek-strava-info-segment > .kqomPower { width: 12%; text-align: right; }\n"+
			".zbynek-strava-info-segment > .link { width: 6%; text-align: right; }\n"+
			"";
		//GM_addStyle(style);
		dwrapper.needXpathNode("//head", document).appendChild(dwrapper.createElementEx("style", { type: "text/css" }, [
			dwrapper.createTextNode(style)
		]));
	}

	function initializeMenu()
	{
		let sidenavEl = dwrapper.needXpathNode("//*[contains(concat(' ', @class, ' '), ' sidenav ')]/ul[@id = 'pagenav']", document);
		let evaluateEl = dwrapper.createElementEx("li", null, [
			dwrapper.createElementEx("ul", null, [
				dwrapper.createElementEx("li", null, [ dwrapper.createTextNode("Zbynek Info Segments") ]),
				dwrapper.createElementEx("li", null, [
					dwrapper.createElementEx("a", { onclick: function() { enrichSegments(); } }, [ dwrapper.createTextNode("Info Segments") ])
				]),
				dwrapper.createElementEx("li", null, [
					dwrapper.createElementEx("a", { onclick: function() { importDb(); } }, [ dwrapper.createTextNode("Import Db") ])
				]),
				dwrapper.createElementEx("li", null, [
					dwrapper.createElementEx("a", { onclick: function() { exportDb(); } }, [ dwrapper.createTextNode("Export Db") ])
				]),
				dwrapper.createElementEx("li", null, [
					dwrapper.createElementEx("a", { href: "https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=J778VRUGJRZRG&item_name=Support+features+development.&currency_code=CAD&source=url", target: "_blank" }, [ dwrapper.createTextNode("Support features development") ])
				]),
			])
		]);
		sidenavEl.appendChild(evaluateEl);
	}

	initializeData();
	initializeUi();
	initializeMenu();

}, false);
