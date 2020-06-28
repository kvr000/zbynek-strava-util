// ==UserScript==
// @id          https://github.com/kvr000/zbynek-strava-util/ZbynekStravaStats/
// @name        Zbynek Strava Stats
// @namespace   https://github.com/kvr000/zbynek-strava-util/
// @description Strava - Enhance Athlete main page by showing statistics per specific activity type
// @author      Zbynek Vyskovsky, kvr000@gmail.com https://github.com/kvr000/
// @copyright   2020+, Zbynek Vyskovsky,kvr000@gmail.com (https://github.com/kvr000/zbynek-strava-util/)
// @license     Apache-2.0
// @homepage    https://github.com/kvr000/zbynek-strava-util/
// @homepageURL https://github.com/kvr000/zbynek-strava-util/
// @downloadURL https://raw.githubusercontent.com/kvr000/zbynek-strava-util/master/ZbynekStravaStats/ZbynekStravaStats.user.js
// @updateURL   https://raw.githubusercontent.com/kvr000/zbynek-strava-util/master/ZbynekStravaStats/ZbynekStravaStats.user.js
// @supportURL  https://github.com/kvr000/zbynek-strava-util/issues/
// @contributionURL https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=J778VRUGJRZRG&item_name=Support+features+development.&currency_code=CAD&source=url
// @version     1.0.0
// @include     https://www.strava.com/athletes/*
// @include     http://www.strava.com/athletes/*
// @include     https://strava.com/athletes/*
// @include     http://strava.com/athletes/*
// @grant       GM_log
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// @grant       GM_setClipboard
// @run-at      document-idle
// ==/UserScript==
/*jshint loopfunc:true */

window.addEventListener('load', () => {
	'use strict';
	const $ = unsafeWindow.jQuery;

	class Js
	{
		static undefinedElse(value, defaultValue)
		{
			return value === undefined ? defaultValue : value;
		}

		static undefinedElseGet(value, supplier)
		{
			return value === undefined ? supplier() : value;
		}

		static undefinedElseThrow(value, exceptionSupplier)
		{
			if (value === undefined)
				throw exceptionSupplier();
			return value;
		}

		static nullElse(value, defaultValue)
		{
			return value == null ? defaultValue : value;
		}

		static nullElseGet(value, supplier)
		{
			return value == null ? supplier() : value;
		}

		static nullElseThrow(value, exceptionSupplier)
		{
			if (value == null)
				throw exceptionSupplier();
			return value;
		}

		static objGetElse(obj, key, defaultValue)
		{
			return key in obj ? obj[key] : defaultValue;
		}

		static objGetElseGet(obj, key, supplier)
		{
			return key in obj ? obj[key] : supplier(key);
		}

		static objGetElseThrow(obj, key, exceptionSupplier)
		{
			if (key in obj)
				return obj[key];
			throw exceptionSupplier(key);
		}

		static strEmptyToNull(str)
		{
			return str === "" ? null : str;
		}

		static strValueToNull(nullvalue, str)
		{
			return str === nullvalue ? null : str;
		}

		static strNullToEmpty(str)
		{
			return str === "" ? null : str;
		}

		static objMap(obj, mapper)
		{
			return obj == null ? null : mapper(obj);
		}

		static escapeRegExp(string) {
			return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		}
	}

	class HtmlWrapper
	{
		constructor(doc)
		{
			this.doc = doc;
		}

		evaluate(...args)
		{
			return this.doc.evaluate(...args);
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
			const elements = [];
			for (let xpathOut = this.doc.evaluate(xpath, start), el = null; (el = xpathOut.iterateNext()); ) {
				elements.push(el);
			}
			return elements;
		}

		removeXpath(xpath, start)
		{
			this.listXpath(xpath, start).forEach((node) => node.remove());
		}

		insertAfter(inserted, before)
		{
			before.parentNode.insertBefore(inserted, before.nextSibling);
		}

		insertMultiBefore(inserted, after)
		{
			inserted.forEach((e) => after.parentElement.insertBefore(e, after));
		}

		insertMultiAfter(inserted, before)
		{
			let last = before;
			inserted.forEach((e) => { this.insertAfter(e, before); before = e; });
		}

		appendMulti(inserted, parentElement)
		{
			inserted.forEach((e) => parentElement.appendChild(e));
		}

		childElementPosition(child)
		{
			let i = 0;
			for (let left = child; (left = left.previousElementSibling) != null; ++i) ;
			return i;
		}

		createElementEx(name, attrs, children)
		{
			const element = this.doc.createElement(name);
			if (attrs) {
				Object.getOwnPropertyNames(attrs).forEach((k) => { const v = attrs[k]; if (k === 'class') element.setAttribute(k, v); else element[k] = v; });
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

		createSelect(attrs, options, current, listener)
		{
			const optionsElements = [];
			$.each(options, (k, v) => optionsElements.push(v instanceof Node ?
			       	this.createElementEx("option", { value: k }, [ v ]) :
				this.createElementWithText("option", { value: k }, v)
			));
			const element = this.createElementEx("select", attrs, optionsElements);
			element.value = current == null && attrs.emptyIsNull ? "" : String(current);
			element.updateListener = listener;
			element.onchange = (event) => { event.target.updateListener(event.target.value == "" && event.target.emptyIsNull ? null : event.target.value) };
			return element;
		}

		templateElement(html, placeholders, prefix = 'pl$-')
		{
			const elements = this.templateElements(html, placeholders, prefix);
			if (elements.length != 1) {
				throw Error("Template resulted into multiple elements: ", elements);
			}
			return elements[0];
		}

		templateElements(html, placeholders, prefix = 'pl$-')
		{
			const elements = $.parseHTML(html);
			for (let i = 0; i < elements.length; ++i) {
				let current = elements[i];
				if (!(current instanceof Element))
					continue;
				while (current != null) {
					if (current.localName.startsWith(prefix)) {
						const command = current.localName.substring(prefix.length);
						switch (command) {
							case 'text':
							case 'textrun': {
								if (current.firstChild != null)
									throw new Error("Replacement node contains unexpected subelements: "+current);
								const textName = Js.nullElseThrow(current.getAttribute("name"), () => new Error("Cannot find name attribute in element: "+current));
								const providedText = Js.objGetElseThrow(placeholders, textName, () => new Error("Cannot find placeholder: "+textName));
								const node = current.parentNode.insertBefore(this.doc.createTextNode(command == 'textrun' ? providedText(current, this) : providedText), current);
								const old = current;
								current = node;
								old.remove();
								break;
							}

							case 'node':
							case 'noderun': {
								if (current.firstChild != null)
									throw new Error("Replacement node contains unexpected subelements: "+current);
								const nodeName = Js.nullElseThrow(current.getAttribute("name"), () => new Error("Cannot find name attribute in element: "+current));
								const providedNode = Js.objGetElseThrow(placeholders, nodeName, () => new Error("Cannot find placeholder: "+nodeName));
								const node = current.parentNode.insertBefore(command == 'noderun' ? providedNode(current, this) : providedNode, current);
								const old = current;
								current = node;
								old.remove();
								break;
							}

							case 'if':
							case 'ifrun': {
								let trueEl;
								let falseEl;
								if (current.firstElementChild == null || current.firstElementChild.nextSibling == null || current.firstElementChild.nextSibling.nextSibling != null) {
									throw new Error("Expected exactly two elements of if block, true and false: "+current);
								}
								if (current.firstElementChild.localName == 'true') {
									trueEl = current.firstElementChild;
									if (trueEl.nextSibling.localName != 'false')
										throw new Error("Expected false block, got "+trueEl.nextSibling);
									falseEl = trueEl.nextSibling;
								}
								else if (current.firstElementChild.localName == 'false') {
									falseEl = current.firstElementChild;
									if (falseEl.nextSibling.localName != 'true')
										throw new Error("Expected false block, got "+falseEl.nextSibling);
									trueEl = trueEl.nextSibling;
								}
								const conditionName = Js.nullElseThrow(current.getAttribute("condition"), () => new Error("Cannot find condition attribute in element: "+current));
								const condition = Js.objGetElseThrow(placeholders, conditionName, () => new Error("Cannot find placeholder: "+conditionName));
								const chosen = (command == 'ifrun' ? condition(current, this) : condition) ? trueEl : falseEl;
								let restart = chosen.firstElementChild;
								while (chosen.firstChild) {
									const next = chosen.firstChild;
									current.parentNode.insertBefore(next, current);
								}
								if (restart == null) {
									restart = current;
									do {
										if (restart.nextElementSibling != null) {
											restart = restart.nextElementSibling;
											break;
										}
										restart = restart.parentElement;
									} while (restart != null);
								}
								current.remove();
								current = restart;
								continue;
							}

							default:
								throw new Error("Unexpected element: "+current);
						}
					}
					else {
						if (current.attributes.length != 0) {
							const names = [];
							for (let i = 0; i < current.attributes.length; ++i) {
								names.push(current.attributes[i].name);
							}
							names.forEach((name) => {
								if (name.startsWith(prefix)) {
									const placeholder = current.getAttribute(name);
									current[name.substring(prefix.length)] =  Js.objGetElseThrow(placeholders, placeholder, () => new Error("Cannot find placeholder: "+placeholder));
									current.removeAttribute(name);
								}
							});
						}
						if (current.firstElementChild != null) {
							current = current.firstElementChild;
							continue;
						}
					}
					do {
						if (current.nextElementSibling != null) {
							current = current.nextElementSibling;
							break;
						}
						current = current.parentElement;
					} while (current != null);
				}
			}
			return elements;
		}

		setVisible(element, isVisible, visibilityType = 'block')
		{
			element.style.display = isVisible ? visibilityType : 'none';
			return isVisible;
		}

	}

	/**
	 * UI for Athlete Stats UI
	 */
	class ZbynekStravaAthleteStatsUi
	{
		static DESCRIPTIVE_TIME_MATCH = /^\s*((\d+)d)?\s*((\d+)h)?\s*((\d+)m)?\s*((\d+)s)?\s*$/;

		dwrapper;

		totalsEl = null;
		perTypeEls = [];
		activitySelectEl = null;

		sortedStats = null;
		preferredActivity = null;

		constructor(documentWrapper)
		{
			this.dwrapper = documentWrapper;
		}

		parseFloat(value)
		{
			if (!value)
				return null;
			return Number(value.replace(",", ""));
		}

		parseDescriptiveTime(value)
		{
			if (!value)
				return null;
			const group = value.match(ZbynekStravaAthleteStatsUi.DESCRIPTIVE_TIME_MATCH);
			if (group == null) {
				return null;
			}
			return ((Number(group[2] || 0)*24+Number(group[4] || 0))*60+Number(group[6] || 0))*60+Number(group[8] || 0);
		}

		formatTime(time)
		{
			const sec = time%60;
			let rest = parseInt(time/60);
			let str = sec.toFixed(0);
			if (rest != 0) {
				const min = rest%60;
				rest = parseInt(rest/60);
				str = min.toFixed(0)+":"+str.padStart(2, "0");
				if (rest != 0) {
					str = rest.toFixed(0)+":"+str.padStart(5, "0");
				}
			}
			return str;
		}

		updateStats()
		{
			const athleteUrl = window.location.pathname;
			const stats = {};
			this.sortedStats = Object.entries(this.dwrapper.listXpath("//*[contains(concat(' ', @class, ' '), ' feed-entry ') and not (contains(concat(' ', @class, ' '), ' group-activity ')) and ./div/a[contains(concat(' ', @class, ' '), 'avatar-content') and @href = \""+athleteUrl.replace("\"", "\\\"")+"\"] and .//*[contains(concat(' ', @class, ' '), ' entry-type-icon ')]//span[contains(concat(' ', @class, ' '), ' app-icon ')]]", this.dwrapper.doc).map(
				(element) => {
					const typeClasses = this.dwrapper.needXpathNode(".//*[contains(concat(' ', @class, ' '), ' entry-type-icon ')]//span[contains(concat(' ', @class, ' '), ' app-icon ')]/@class", element).textContent.split(/\s+/)
						.filter((clazz) => clazz != 'app-icon' && clazz != 'icon-dark' && clazz != 'icon-lg');
					if (typeClasses.length > 0) {
						const typeClass = typeClasses[0];
						const distance = this.parseFloat(this.dwrapper.evaluate(".//li[@title = 'Distance']/text()", element, null, XPathResult.STRING_TYPE).stringValue);
						const elevationGain = this.parseFloat(this.dwrapper.evaluate(".//li[@title = 'Elev Gain']/text()", element, null, XPathResult.STRING_TYPE).stringValue);
						const time = this.parseDescriptiveTime(this.dwrapper.evaluate(".//li[@title = 'Time']", element, null, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue.textContent);
						return {
							activityType: typeClass,
							distance: distance,
							elevationGain: elevationGain,
							time: time || 0,
						};
					}
					else {
						return null;
					}
				})
				.filter(e => e != null)
				.reduce(
					(obj, v) => {
						if (!obj[v.activityType]) {
							obj[v.activityType] = { ...v }
						}
						else {
							obj[v.activityType].distance += v.distance;
							obj[v.activityType].elevationGain += v.elevationGain;
							obj[v.activityType].time += v.time;
						}
						return obj;
					},
					{}
				)
			)
				.sort((a, b) => b[1].distance-a[1].distance)
				.reduce(
					(obj, [k,v]) => ({
						...obj,
						[k]: v
					}),
					{}
				);
			let selected = this.preferredActivity !== null && this.preferredActivity in this.sortedStats ? this.preferredActivity : Object.keys(this.sortedStats)[0];
			if (this.preferredActivity === null) {
				this.preferredActivity = selected;
			}
			this.activitySelectEl = this.dwrapper.createSelect(
				{ $class: "zbynek-inline-select" },
				Object.keys(this.sortedStats).reduce((obj, k) => ({ ...obj, [k]: this.dwrapper.createElementWithText("span", { class: "app-icon "+k  }, k.replace("icon-", "")) }), {}),
				selected,
				(key) => { this.preferredActivity = key; this.selectStat(key); }
			);
			this.perTypeEls.forEach((node) => node.remove());
			this.perTypeEls = this.dwrapper.templateElements(
				""+
					"<li id='activitySelect'><pl$-node name='activitySelect'></pl$-node></li>\n"+
					"<li id='activityDistance'>_<abbr>km</abbr></li>\n"+
					"<li id='activityTime'>_<abbr>s</abbr></li>\n"+
					"<li id='activityElevationGain'>_<abbr>m</abbr></li>\n"+
					"",
				{
					activitySelect: this.activitySelectEl,
				},
				"pl$-"
			);

			this.dwrapper.appendMulti(this.perTypeEls, this.totalsEl);
			this.selectStat(selected);
		}

		selectStat(key)
		{
			const stat = this.sortedStats[key];
			this.dwrapper.needXpathNode(".//*[@id = 'activityDistance']", this.totalsEl).firstChild.textContent = stat.distance?.toFixed(1);
			this.dwrapper.needXpathNode(".//*[@id = 'activityTime']", this.totalsEl).firstChild.textContent = this.formatTime(stat.time);
			this.dwrapper.needXpathNode(".//*[@id = 'activityElevationGain']", this.totalsEl).firstChild.textContent = stat.elevationGain?.toFixed(0);
		}

		setupListener()
		{
			let feedEl = this.dwrapper.needXpathNode("//div[contains(concat(' ', @class, ' '), ' feed ')]", document);
			new MutationObserver(() => this.updateStats()).observe(feedEl, { attributes: false, childList: true, subtree: false });
			let intervalRidesEl = this.dwrapper.needXpathNode("//div[@id = 'interval-rides']", document);
			new MutationObserver(() => this.updateStats()).observe(intervalRidesEl, { attributes: false, childList: true, subtree: false });
		}

		initializeStatic()
		{
			const style =
				".zbynek-strava-inline-select { appearance: none; border: none; }\n"+
				".zbynek-strava-max-width { width: 100%; }\n"+
				"\n"+
				".zbynek-strava-stats-header { display: block; text-align: center }\n"+
				".zbynek-strava-stats-header > span { display: inline-block; text-align: center; padding-left: 5px; padding-right: 5px; border-left: 1px; font-weight: bold; }\n"+
				"";
			GM_addStyle(style);
		}

		initializeUi()
		{
			this.totalsEl = this.dwrapper.needXpathNode("//*[@id = 'interval-graph']//ul[@id = 'totals']", this.dwrapper.doc);

			this.setupListener();
			this.updateStats();
		}

		init()
		{
			this.initializeStatic();
			this.initializeUi();
		}
	}

	if (/^\/athletes\/\w+\/?$/.test(window.location.pathname)) {
		new ZbynekStravaAthleteStatsUi(
			new HtmlWrapper(document)
		)
			.init();
	}
	else {
		GM_log("Failed to match URL to known pattern, ignoring: "+window.location.pathname);
	}

}, false);

// vim: set sw=8 ts=8 noet smarttab:
