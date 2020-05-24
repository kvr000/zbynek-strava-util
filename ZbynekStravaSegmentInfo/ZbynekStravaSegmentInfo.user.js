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
// @downloadURL https://raw.githubusercontent.com/kvr000/zbynek-strava-util/master/ZbynekStravaSegmentInfo/ZbynekStravaSegmentInfo.user.js
// @updateURL   https://raw.githubusercontent.com/kvr000/zbynek-strava-util/master/ZbynekStravaSegmentInfo/ZbynekStravaSegmentInfo.user.js
// @supportURL  https://github.com/kvr000/zbynek-strava-util/issues/
// @contributionURL https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=J778VRUGJRZRG&item_name=Support+features+development.&currency_code=CAD&source=url
// @version     0.0.4
// @include     https://www.strava.com/activities/*/potential-segment-matches
// @include     http://www.strava.com/activities/*/potential-segment-matches
// @include     https://strava.com/activities/*/potential-segment-matches
// @include     http://strava.com/activities/*/potential-segment-matches
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

		static objGetElse(map, key, defaultValue)
		{
			return key in map ? map[key] : defaultValue;
		}

		static objGetElseGet(map, key, supplier)
		{
			return key in map ? map[key] : supplier(key);
		}

		static objGetElseThrow(map, key, exceptionSupplier)
		{
			if (key in map)
				return map[key];
			throw exceptionSupplier(key);
		}

		static strEmptyToNull(str)
		{
			return str === "" ? null : str;
		}

		static strNullToEmpty(str)
		{
			return str === "" ? null : str;
		}

		static objMap(obj, mapper)
		{
			return obj == null ? null : mapper(obj);
		}

	}

	class GmAjaxService
	{
		execute(method, url, options = null, data = null)
		{
			return new Promise((resolve, reject) => {
				try {
					const fullOptions = Object.assign(
						{
							method,
							url,
						},
						options || {},
						{
							onload: (response) => response.status == 200 ? resolve(response.responseText) : reject("Failed "+method+" "+url+" : "+response.status+" "+response.statusText),
							onerror: reject,
							ontimeout: reject,
						}
					);
					GM_xmlhttpRequest(fullOptions);
				}
				catch (err) {
					reject(err);
				}
			});
		}

		executeTemplate(method, urlTemplate, placeholders, options = null, data = null)
		{
			const url = this.convertTemplate(urlTemplate, placeholders);;
			return this.execute(method, url, options, data);
		}

		get(url, options = null)
		{
			return this.execute("GET", url, options);
		}

		getTemplate(urlTemplate, placeholders, options = null)
		{
			return this.executeTemplate("GET", urlTemplate, placeholders, options);
		}

		convertTemplate(urlTemplate, placeholders)
		{
			return urlTemplate.replace(/{([^}]+)}/g, (full, group1) => encodeURIComponent(Js.objGetElseThrow(placeholders, group1, (group1) => new Error("Undefined placeholder: "+group1))));
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
			let node;
			if ((node = this.doc.evaluate(xpath, start, null, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue) != null) {
				node.remove();
			}
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
			$.each(options, (k, v) => optionsElements.push(this.createElementWithText("option", { value: k }, v)));
			const element = this.createElementEx("select", attrs, optionsElements);
			element.value = current == null && attrs.emptyIsNull ? "" : String(current);
			element.updateListener = listener;
			element.onchange = (event) => { event.target.updateListener(event.target.value == "" && event.target.emptyIsNull ? null : event.target.value) };
			return element;
		}

		templateElement(html, placeholders, prefix = 'pl$-')
		{
			const element = this.doc.createElement("span");
			element.innerHTML = html;
			for (let current = element.firstChild; current != null; ) {
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
							let restart = chosen.firstChild;
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
			if (element.firstChild.nextSibling != null) {
				throw Error("Template resulted into multiple elements: ", element.children);
			}
			return element.firstChild;
		}

		setVisible(element, isVisible, visibilityType = 'block')
		{
			element.style.display = isVisible ? visibilityType : 'none';
			return isVisible;
		}

	}

	class AbstractCache
	{
		constructor(version, expiration)
		{
			this.version = version;
			this.expiration = expiration;
			this.pendingPromises = {};
		}

		promiseIfAbsent(id, resolver)
		{
			const item = this.get(id);
			if (!item) {
				let promise = this.pendingPromises[id];
				if (promise == null) {
					promise = this.pendingPromises[id] = resolver(id);
				}
				return promise.then(
					(result) => { delete this.pendingPromises[id]; this.put(id, result); return result; },
					(error) => { delete this.pendingPromises[id]; throw error; },
				);
			}
			return Promise.resolve(item);
		}

	}

	class GlobalDbStorageCache extends AbstractCache
	{
		constructor(storage, name, version, expiration)
		{
			super(version, expiration);
			this.storage = storage;
			this.name = name;
			this.pendingWrite = false;
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
			const item = this.cache[id];
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

		dump()
		{
			return JSON.stringify(this.cache, null, "\t");
		}

		load(dump)
		{
			this.cache = JSON.parse(dump);
		}

	}

	class PerItemStorageCache extends AbstractCache
	{
		constructor(storage, name, version, expiration)
		{
			super(version, expiration);
			this.storage = storage;
			this.prefix = name+"#";
			this.pendingWrite = false;
		}

		get(id)
		{
			try {
				const item = JSON.parse(this.storage.getItem(constructPath(id)));
				if (item) {
					if (item.version == this.version && (item.expire == null || item.expire > new Date().getTime())) {
						return item.value;
					}
					remove(id);
				}
			}
			catch (error) {
			}
			return null;
		}

		put(id, value)
		{
			this.storage.setItem(
				constructPath(id),
				JSON.stringify({
					expire: this.expiration == null ? null : new Date().getTime()+this.expiration,
				       	version: this.version,
				       	value: value
				})
			);
		}

		remove(id)
		{
			this.storage.removeItem(constructPath(id));
		}

		constructPath(id)
		{
			return this.prefix+id;
		}

		dump()
		{
			let db = {};
			for (let i = 0; i < this.storage.length; ++i) {
				const key = this.storage.key(i);
				if (key.startsWith(this.prefix)) {
					db[key.substring(this.prefix.length)] = this.storage.getItem(key);
				}
			}
			return JSON.stringify(db, null, "\t");
		}

		load(dump)
		{
			let db = JSON.parse(dump);
			Object.getOwnPropertyNames(db).forEach((key) => {
				this.storage.setItem(this.constructPath(key), JSON.stringify(db[key]));
			});
		}

	}

	class CsvFormatter
	{
		static SPECIAL_MATCH = /[",]/;

		headerMap = null;
		headerIndex = null;
		output = "";

		constructor()
		{
		}

		writeHeader(headerMap)
		{
			let i = 0;
			this.headerMap = headerMap;
			this.headerIndex = {};
			let array = [];
			Object.getOwnPropertyNames(headerMap).forEach((key) => {
				this.headerIndex[key] = i;
				array[i] = this.headerMap[key];
				i++;
			});
			this.writeArray(array);
		}

		writeMapped(row)
		{
			if (this.headerIndex == null) {
				throw new Error("headerMap not provided yet");
			}
			let array = [];
			Object.getOwnPropertyNames(row).forEach((key) => {
				let index = this.headerIndex[key];
				if (index == null) {
					throw new Error("headerMap not provided for field: "+key);
				}
				array[index] = row[key];
			});
			this.writeArray(array);
		}

		writeArray(row)
		{
			this.output += row.map((item) => this.formatItem(item)).join(",")+"\n";
		}

		getOutput()
		{
			return this.output;
		}

		formatItem(item)
		{
			let str = item == null ? "" : String(item);
			if (CsvFormatter.SPECIAL_MATCH.test(str)) {
				str = '"'+str.replace('"', '""')+'"';
			}
			return str;
		}
	}

	class ZbynekStravaSegmentInfoUi
	{
		/* constants */
		static PR_MATCH = /^\s*\u21b5?\s*((\d+:)*\d+)\s*\u21b5?\s*$/;
		static TIME_MATCH = /^((((\d+)d\s*)?(\d+):)?(\d+):)?(\d+)$/;
		static LEVELS = {
			"": "",
			1: "L1 (Relax)",
		       	2: "L2 (Always)",
		       	3: "L3 (Easy)",
		       	4: "L4 (Medium)",
		       	5: "L5 (Difficult)",
		       	6: "L6 (Extreme)",
		       	7: "L7 (Local)",
		       	8: "L8 (Pro)",
		       	9: "L9 (Tour)",
		       	11: "Dangerous",
		       	12: "Short",
		       	13: "Flagged",
		       	14: "Wrong"
		};

		/* dependencies */
		ajaxService;
		segmentInfoCache;
		segmentPreferenceDb;
		dwrapper;

		/* UI */
		menuEl;
		filterEl;

		/* status */
		filterEnabled = false;
		batchUpdateEnabled = false;
		filterFunction = () => true;

		constructor(ajaxService, segmentInfoCache, segmentPreferenceDb, documentWrapper)
		{
			this.ajaxService = ajaxService;
			this.segmentInfoCache = segmentInfoCache;
			this.segmentPreferenceDb = segmentPreferenceDb;
			this.dwrapper = documentWrapper;
		}

		updatePreference(segmentFull)
		{
			this.segmentPreferenceDb.put(segmentFull.segment.id, segmentFull.preference);
		}

		convertTimeStr(timeStr)
		{
			if (!timeStr)
				return null;
			const group = timeStr.match(ZbynekStravaSegmentInfoUi.TIME_MATCH);
			if (group == null)
				throw new Error("Failed to match time for: "+timeStr);
			return ((Number(group[4] || 0)*24+Number(group[5] || 0))*60+Number(group[6] || 0))*60+Number(group[7]);
		}

		formatDate(time)
		{
			return Js.objMap(
				new Date(time),
				(d) => d.getUTCFullYear().toFixed(0).padStart(4, "0")+"-"+(d.getUTCMonth()+1).toFixed(0).padStart(2, "0")+"-"+d.getUTCDate().toFixed(0).padStart(2, "0")
			);
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

		formatTimeHms(time)
		{
			const sec = time%60;
			let rest = parseInt(time/60);
			let str = sec.toFixed(0);
			const min = rest%60;
			rest = parseInt(rest/60);
			str = min.toFixed(0)+":"+str.padStart(2, "0");
			str = rest.toFixed(0)+":"+str.padStart(5, "0");
			return str;
		}
		
		formatLevel(level)
		{
			return ZbynekStravaSegmentInfoUi.LEVELS[Js.strNullToEmpty(Js.objMap(level, String))];
		}

		enrichSegments()
		{
			let counter = 0;
			let processedCounter = 0;
			const segments = this.dwrapper.listXpath("//*[@id='segment-visualizer']//ul[contains(concat(' ', @class, ' '), ' list-segments ')]/li[contains(concat(' ', @class, ' '), ' segment-row ')]", this.dwrapper.doc);
			for (let segmentIdx in segments) {
				const segmentRow = segments[segmentIdx];
				const segmentId = segmentRow.getAttribute("data-segment-id");
				Promise.all([
					Promise.resolve(segmentRow),
					this.segmentPreferenceDb.promiseIfAbsent(segmentId, (segmentId) => Promise.resolve({
						level: null,
						type: null,
						protect: null,
					})),
					this.segmentInfoCache.promiseIfAbsent(segmentId, (segmentId) =>
						Promise.all([
							this.ajaxService.getTemplate("/segments/{segmentId}", { segmentId }),
							this.ajaxService.getTemplate("/stream/segments/{segmentId}?streams%5B%5D=altitude", { segmentId }),
						])
							.then((responses) => {
								const root = new DOMParser().parseFromString(responses[0], 'text/html');
								const name = Js.strEmptyToNull(root.evaluate("//div[contains(@class, 'segment-heading')]//*[@id='js-full-name']/text()", root, null, XPathResult.STRING_TYPE, null).stringValue);
								const distance_str = Js.strEmptyToNull(root.evaluate("//div[contains(@class, 'segment-heading')]//div[@class='stat' and span[@class='stat-subtext' and text() = 'Distance']]/*[@class='stat-text']/text()", root, null, XPathResult.STRING_TYPE, null).stringValue);
								const elevationDiff_str = Js.strEmptyToNull(root.evaluate("//div[contains(@class, 'segment-heading')]//div[@class='stat' and span[@class='stat-subtext' and text() = 'Elev Difference']]/*[@class='stat-text']/text()", root, null, XPathResult.STRING_TYPE, null).stringValue);
								const avgGrade_str = Js.strEmptyToNull(root.evaluate("//div[contains(@class, 'segment-heading')]//div[@class='stat' and span[@class='stat-subtext' and text() = 'Avg Grade']]/*[@class='stat-text']/text()", root, null, XPathResult.STRING_TYPE, null).stringValue);
								const prTime_str = Js.strEmptyToNull(root.evaluate("//div[contains(concat(' ', @class, ' '), ' result ') and @data-tracking-element = 'pr_effort']/strong[contains(text(), 'All-Time PR')]/following-sibling::text()", root, null, XPathResult.STRING_TYPE).stringValue.match(ZbynekStravaSegmentInfoUi.PR_MATCH)?.[1]);
								const prLink = Js.strEmptyToNull(root.evaluate("//div[contains(concat(' ', @class, ' '), ' result ') and @data-tracking-element = 'pr_effort']/span[contains(concat(' ', @class, ' '), ' timestamp ')]/a/@href", root, null, XPathResult.STRING_TYPE).stringValue);
								const prDate_str = Js.strEmptyToNull(root.evaluate("//div[contains(concat(' ', @class, ' '), ' result ') and @data-tracking-element = 'pr_effort']/span[contains(concat(' ', @class, ' '), ' timestamp ')]/a/text()", root, null, XPathResult.STRING_TYPE).stringValue);
								const komTime_str = Js.strEmptyToNull(root.evaluate("//div[contains(concat(' ', @class, ' '), ' result ') and @data-tracking-element = 'kom_effort']/strong[contains(text(), 'KOM')]/following-sibling::text()", root, null, XPathResult.STRING_TYPE).stringValue.match(ZbynekStravaSegmentInfoUi.PR_MATCH)?.[1]);
								const komLink = Js.strEmptyToNull(root.evaluate("//div[contains(concat(' ', @class, ' '), ' result ') and @data-tracking-element = 'kom_effort']/span[contains(concat(' ', @class, ' '), ' timestamp ')]/a/@href", root, null, XPathResult.STRING_TYPE).stringValue);
								const qomTime_str = Js.strEmptyToNull(root.evaluate("//div[contains(concat(' ', @class, ' '), ' result ') and @data-tracking-element = 'qom_effort']/strong[contains(text(), 'QOM')]/following-sibling::text()", root, null, XPathResult.STRING_TYPE).stringValue.match(ZbynekStravaSegmentInfoUi.PR_MATCH)?.[1]);
								const qomLink = Js.strEmptyToNull(root.evaluate("//div[contains(concat(' ', @class, ' '), ' result ') and @data-tracking-element = 'qom_effort']/span[contains(concat(' ', @class, ' '), ' timestamp ')]/a/@href", root, null, XPathResult.STRING_TYPE).stringValue);
								const bestTime_str = Js.strEmptyToNull(root.evaluate("//table[contains(concat(' ', @class, ' '), 'table-leaderboard')]/tbody/tr[1]/td[@class='last-child']/text()", root, null, XPathResult.STRING_TYPE, null).stringValue);
								const bestSpeed_str = Js.strEmptyToNull(root.evaluate("//table[contains(concat(' ', @class, ' '), 'table-leaderboard')]/tbody/tr[1]/td[abbr[text() = 'km/h']]/text()", root, null, XPathResult.STRING_TYPE, null).stringValue);
								const bestBpm_str = Js.strEmptyToNull(root.evaluate("//table[contains(concat(' ', @class, ' '), 'table-leaderboard')]/tbody/tr[1]/td[abbr[text() = 'bpm']]/text()", root, null, XPathResult.STRING_TYPE, null).stringValue);
								const bestPower_str = Js.strEmptyToNull(root.evaluate("//table[contains(concat(' ', @class, ' '), 'table-leaderboard')]/tbody/tr[1]/td[abbr[text() = 'W']]/text()", root, null, XPathResult.STRING_TYPE, null).stringValue);
								const bestVam_str = Js.strEmptyToNull(root.evaluate("//table[contains(concat(' ', @class, ' '), 'table-leaderboard')]/tbody/tr[1]/td[@class='last-child']/preceding-sibling::td[1]/text()", root, null, XPathResult.STRING_TYPE, null).stringValue);

								const route = JSON.parse(responses[1]);
								const distance = Js.objMap(distance_str, Number);
								const elevationGain = route.altitude.reduce((total, current, index, array) => total+(index == 0 ? 0 : Math.max(0, current-array[index-1])), 0);
								const elevationDiff = Js.nullElseGet(route.altitude.length > 0 ? route.altitude[route.altitude.length-1]-route.altitude[0] : null, () => Js.objMap(elevationDiff_str, Number));
								const avgGradeStrava = Js.objMap(avgGrade_str, Number);
								const avgGrade = distance != null && elevationDiff != null ? elevationDiff/(distance*10) : avgGradeStrava;
								const segmentInfo = {
									info: {
										id: segmentId,
										name: name,
										distance: distance,
										avgGradeStrava: avgGradeStrava,
										avgGrade: avgGrade,
										elevationDiff: elevationDiff,
										elevationGain: elevationGain,
										url: this.ajaxService.convertTemplate("https://www.strava.com/segments/{segmentId}", { segmentId: segmentId }),
									},
									isKqom: prLink != null && (prLink == komLink || prLink == qomLink),
									pr: {
										time: this.convertTimeStr(prTime_str),
										link: prLink,
										date: Js.objMap(prDate_str, (str) => Date.parse(str+" UTC")),
									},
									kom: {
										time: this.convertTimeStr(komTime_str),
										link: komLink,
									},
									qom: {
										time: this.convertTimeStr(qomTime_str),
										link: qomLink,
									},
									best: {
										time: this.convertTimeStr(bestTime_str),
										speed: Js.objMap(bestSpeed_str, Number),
										heartRate: Js.objMap(bestBpm_str, Number),
										power: Js.objMap(bestPower_str, Number),
										vam: Js.objMap(bestVam_str, Number),
									},
								};
								this.segmentInfoCache.put(segmentId, segmentInfo);
								GM_log(segmentInfo);
								return segmentInfo;
							})
					)
				])
					.then((segmentAll) => {
						const segmentRow = segmentAll[0];
						const segmentFull = {
							preference: segmentAll[1],
							segment: segmentAll[2],
						};
						try {
							this.dwrapper.removeXpath("./span[@id='zbynek-strava-segment-info-segment']", segmentRow);
							const segment = segmentFull.segment;
							const preference = segmentFull.preference;
							const infoEl = this.dwrapper.templateElement(
								""+
									"<span id='zbynek-strava-segment-info-segment' class='zbynek-strava-segment-info-segment' pl$-segmentfull='segmentFull' pl$-onchange='emptyFunc'>"+
									"<span class='distance'><pl$-text name='distance_str'></pl$-text>km</span>"+
									"<span class='grade'><pl$-text name='avgGrade_str'></pl$-text>%</span>"+
									"<span class='elevationGain'><pl$-text name='elevationGain_str'></pl$-text>m</span>"+
									"<span class='prTime'><pl$-if condition='pr_link'><true><a pl$-href='pr_link' target='_blank'><pl$-textrun name='pr_time_str'></pl$-textrun>s</a></true><false></false></pl$-if></span>"+
									"<span class='prKqomIndicator'><pl$-text name='pr_isKqom_str'></pl$-text></span>"+
									"<span class='kqomTime'><pl$-if condition='kqom_link'><true><a pl$-href='kqom_link' target='_blank'><pl$-textrun name='kqom_time_str'></pl$-textrun>s</a></true><false></false></pl$-if></span>"+
									"<span class='kqomSpeed'><pl$-ifrun condition='kqom_speed_str'><true><pl$-textrun name='kqom_speed_str'></pl$-textrun>km/h</true><false></false></pl$-if></span>"+
									"<span class='kqomPower'><pl$-ifrun condition='kqom_power_str'><true><pl$-textrun name='kqom_power_str'></pl$-textrun>W</true><false></false></pl$-if></span>"+
									"<span class='level'><pl$-node name='levelSelect'></pl$-node></span>"+
									"<span class='type'><pl$-node name='typeSelect'></pl$-node></span>"+
									"<span class='segmentLink'><a pl$-href='segmentLink' target='_blank'>\uD83D\uDD17</a></span>"+
									"</span>",
								{
									emptyFunc: () => {},
									segmentFull: segmentFull,
									distance_str: segment.info.distance?.toFixed(2),
									avgGrade_str: segment.info.avgGrade?.toFixed(1),
									elevationGain_str: segment.info.elevationGain?.toFixed(0),
									pr_link: Js.nullElse(segment.pr.link, ""),
									pr_time_str: () => this.formatTime(segment.pr.time),
									pr_isKqom_str: segment.isKqom ? "\uD83D\uDC51" : "",
									kqom_link: segment.kom.link,
									kqom_time_str: () => this.formatTime(segment.best.time),
									kqom_speed_str: () => segment.best.speed?.toFixed(1),
									kqom_power_str: () => segment.best.power?.toFixed(0),
									levelSelect: this.dwrapper.createSelect({ class: "zbynek-strava-inline-select", emptyIsNull: true }, ZbynekStravaSegmentInfoUi.LEVELS, preference.level, (value) => {
										segmentFull.preference.level = value;
										this.updatePreference(segmentFull);
									}),
									typeSelect: this.dwrapper.createSelect({ class: "zbynek-strava-inline-select", emptyIsNull: true }, { "": "", road: "Rd", gravel: "Gr", mtb: "Mtb" }, preference.type, (value) => {
										segmentFull.preference.type = value;
										this.updatePreference(segmentFull);
									}),
									segmentLink: segment.info.url,
								},
								'pl$-'
							);
							segmentRow.appendChild(infoEl);
							if (this.dwrapper.setVisible(segmentRow, this.filterFunction(segmentFull.preference, segmentFull.segment)))
								++processedCounter;
							this.dwrapper.needXpathNode(".//span[@id='counter']", this.menuEl).textContent = "("+processedCounter+")";
						}
						catch (err) {
							GM_log("Failed processing segment: "+segmentFull.segment.info.id, err);
						}
					});
				if (++counter >= 1000000) break;
			}
			GM_log("Segments processed "+counter);
		}

		listVisibleSegments()
		{
			return this.dwrapper.listXpath("//*[@id='segment-visualizer']//ul[contains(concat(' ', @class, ' '), ' list-segments ')]/li[contains(concat(' ', @class, ' '), ' segment-row ') and .//span[@id = 'zbynek-strava-segment-info-segment']]", this.dwrapper.doc)
				.filter((el) => el.style.display != 'none');
		}

		importDb(dialog, input)
		{
			dialog.style.display = 'block';
			input.confirmHandler = () => {
				try {
					this.segmentPreferenceDb.load(input.value);
				}
				catch (err) {
					alert("Failed to parse data from clipboard, please make sure you copied preference dump correctly: "+err);
				}
				dialog.style.display = 'none';
			}
		}

		exportDb()
		{
			GM_setClipboard(this.segmentPreferenceDb.dump());
			alert("Preference dump was copied into clipboard");
		}

		exportList()
		{
			let csvFormatter = new CsvFormatter();
			csvFormatter.writeHeader({
				name: "Name",
				level: "Level",
				done: "Done",
				stat: "Stat",
				distance: "Distance",
				place: "Place",
				orientation: "Orientation",
				direction: "Direction",
				note: "Note",
				time: "Time",
				url: "Url",
			});
			this.listVisibleSegments().forEach((segmentRow) => {
				const segmentFull = this.dwrapper.needXpathNode(".//span[@id = 'zbynek-strava-segment-info-segment']", segmentRow).segmentfull;
				const segment = segmentFull.segment;
				const preference = segmentFull.preference;
				csvFormatter.writeMapped({
					name: segment.info.name,
					level: this.formatLevel(preference.level),
					done: Js.objMap(segment.pr.date, this.formatDate),
					stat: segment.isKqom ? "KOM" : null,
					distance: segment.info.distance,
					time: segment.pr.time != null ? this.formatTimeHms(segment.pr.time) : null,
					url: segment.info.url,
				});
			});
			GM_setClipboard(csvFormatter.getOutput());
			alert("Listed segments exported into clipboard");
		}

		refreshContent()
		{
			if (this.filterEnabled) {
				try {
					if (!(this.filterFunction = eval(this.dwrapper.needXpathNode(".//div[@id='filter']//textarea").value, this.filterEl))) {
						throw new Error("Empty function provided");
					}
				}
				catch (error) {
					alert("Failed to compile filter function: "+error);
				}
			}
			else {
				this.filterFunction = () => true;
			}
			this.enrichSegments();
		}

		runBatchUpdate()
		{
			let batchFunction;
			try {
				if (!(batchFunction = eval(this.dwrapper.needXpathNode(".//div[@id='batchUpdate']//textarea").value, this.filterEl)))
					throw new Error("Empty function provided");
			}
			catch (error) {
				alert("Failed to compile batch update function: "+error);
				return;
			}
			try {
				this.listVisibleSegments().forEach((segmentRow) => {
					const segmentFull = this.dwrapper.needXpathNode(".//span[@id = 'zbynek-strava-segment-info-segment']", segmentRow).segmentfull;
					const newPreference = batchFunction(segmentFull.preference, segmentFull.segment);
					Object.assign(segmentFull.preference, newPreference);
					this.updatePreference(segmentFull);
				});
			}
			catch (error) {
				alert("Failed to execute batch update: "+error);
				return;
			}
			this.enrichSegments();
		}

		initializeStatic()
		{
			const style =
				".zbynek-strava-inline-select { appearance: none; border: none; }\n"+
				".zbynek-strava-max-width { width: 100%; }\n"+
				"\n"+
				".zbynek-strava-segment-info-segment { display: block; }\n"+
				".zbynek-strava-segment-info-segment > span { display: inline-block; text-align: right; padding-left: 0px; padding-right: 0px; font-weight: normal; }\n"+
				".zbynek-strava-segment-info-segment > .distance { width: 12%; text-align: right; }\n"+
				".zbynek-strava-segment-info-segment > .grade { width: 8%; text-align: right; }\n"+
				".zbynek-strava-segment-info-segment > .elevationGain { width: 8%; text-align: right; }\n"+
				".zbynek-strava-segment-info-segment > .prTime { width: 9%; text-align: right; }\n"+
				".zbynek-strava-segment-info-segment > .prKqomIndicator { width: 5%; text-align: right; }\n"+
				".zbynek-strava-segment-info-segment > .kqomTime { width: 9%; text-align: right; }\n"+
				".zbynek-strava-segment-info-segment > .kqomSpeed { width: 15%; text-align: right; }\n"+
				".zbynek-strava-segment-info-segment > .kqomPower { width: 10%; text-align: right; }\n"+
				".zbynek-strava-segment-info-segment > .level { width: 10%; }\n"+
				".zbynek-strava-segment-info-segment > .type { width: 10%; }\n"+
				".zbynek-strava-segment-info-segment > .segmentLink { width: 4%; text-align: right; }\n"+
				"\n"+
				".zbynek-strava-segment-info-filter { padding-top: 40px; padding-left: 20px; padding-right: 20px; }\n"+
				".zbynek-strava-segment-info-filter > .enablers { width: 100%; }\n"+
				".zbynek-strava-segment-info-filter > .enablers > .enabler { display: inline-block; width: 30%; }\n"+
				".zbynek-strava-segment-info-filter > .row { width: 100%; display: none; }\n"+
				".zbynek-strava-segment-info-filter > .row > .name { display: inline-block; width: 20%; }\n"+
				".zbynek-strava-segment-info-filter > .row > .content { display: inline-block; width: 80%; }\n"+
				"";
			//GM_addStyle(style);
			this.dwrapper.needXpathNode("//head", this.dwrapper.doc).appendChild(this.dwrapper.createElementEx("style", { type: "text/css" }, [
				this.dwrapper.createTextNode(style)
			]));
		}

		initializeUi()
		{
			const sidenavEl = this.dwrapper.needXpathNode("//*[contains(concat(' ', @class, ' '), ' sidenav ')]/ul[@id = 'pagenav']", this.dwrapper.doc);
			this.menuEl = this.dwrapper.templateElement(
				""+
					"<li>\n"+
					"	<ul>\n"+
					"		<li>Zbynek Info Segments</li>\n"+
					"		<li><a pl$-onclick='enrichSegmentsFunc'>Info Segments<span id='counter' style='padding-left: 5px;'/></a></li>\n"+
					"		<li>\n"+
					"			<a pl$-onclick='importDbFunc'>Import Db</a>\n"+
					"			<div class='zbynek-strava-segment-info-importDialog' zIndex='32768' style='display: none;'>\n"+
					"				<textarea placeholder='Paste the dump here' rows='80' cols='40'></textarea>\n"+
					"				<button pl$-onclick='importDbSubmitFunc'>Ok</button>\n"+
					"			</div>\n"+
					"		</li>\n"+
					"		<li><a pl$-onclick='exportDbFunc'>Export Db</a></li>\n"+
					"		<li><a pl$-onclick='exportListFunc'>Export List</a></li>\n"+
					"		<li><a pl$-href='donateUrl' target='_blank' title='Support further development by donating to project'>Donate to development</a></li>\n"+
					"	</ul>\n"+
					"</li>",
				{
					enrichSegmentsFunc: (event) => this.enrichSegments(),
					importDbFunc: (event) =>
						this.importDb(
							this.dwrapper.evaluate("../*[@class = 'zbynek-strava-segment-info-importDialog']", event.currentTarget, null, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue,
							this.dwrapper.evaluate("../*[@class = 'zbynek-strava-segment-info-importDialog']//textarea", event.currentTarget, null, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue
						),
					importDbSubmitFunc: (event) =>
						this.dwrapper.evaluate("..//textarea", event.currentTarget, null, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue.confirmHandler(),
					exportDbFunc: () => this.exportDb(),
					exportListFunc: () => this.exportList(),
					donateUrl: "https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=J778VRUGJRZRG&item_name=Support+future+development.&currency_code=CAD&source=url",
				},
				"pl$-"
			);
			sidenavEl.appendChild(this.menuEl);

			const segmentListEl = this.dwrapper.needXpathNode("//ul[contains(concat(' ', @class, ' '), ' list-segments ')]", this.dwrapper.doc);
			this.filterEl = this.dwrapper.templateElement(
				""+
					"<div class='zbynek-strava-segment-info-filter'>\n"+
					"	<div class='enablers'>\n"+
					"		<span class='enabler'>JS Filter <input type='checkbox' pl$-onchange='toggleJsFilter'></input></span>\n"+
					"		<span class='enabler'>Batch Update<input type='checkbox' pl$-onchange='toggleBatchUpdate'></input></span>\n"+
					"		<span class='enabler'><input type='button' value='Update' pl$-onclick='refreshFunc'></input></span>\n"+
					"	</div>\n"+
					"	<div class='row' id='filter'><span class='name' title='JsFilter by JavaScript function'>JS Filter</span><span class='content'><textarea rows='10' class='zbynek-strava-max-width'></textarea></span></div>\n"+
					"	<div class='row' id='batchUpdate'><span class='name' title='Batch update by JavaScript function'><div>JS Batch Update</div><div><input type='button' value='Execute' pl$-onclick='runUpdateFunc'></input></div></span><span class='content'><textarea rows='10' class='zbynek-strava-max-width'></textarea></span></div>\n"+
					"</div>",
				{
					toggleJsFilter: (event) => this.filterEnabled = this.dwrapper.setVisible(this.dwrapper.needXpathNode("../../../div[@id = 'filter']", event.target), event.target.checked),
					toggleBatchUpdate: (event) => this.batchUpdateEnabled = this.dwrapper.setVisible(this.dwrapper.needXpathNode("../../../div[@id = 'batchUpdate']", event.target), event.target.checked),
					refreshFunc: (event) => this.refreshContent(),
					runUpdateFunc: (event) => this.runBatchUpdate(),
				},
				"pl$-"
			);
			segmentListEl.parentNode.insertBefore(this.filterEl, segmentListEl.nextSibling);
		}

		init()
		{
			this.initializeStatic();
			this.initializeUi();
		}
	}

	new ZbynekStravaSegmentInfoUi(
		new GmAjaxService(),
		new GlobalDbStorageCache(window.localStorage, "ZbynekStravaSegmentInfo.segmentInfoCache", 1, 10*86400*1000),
		new GlobalDbStorageCache(window.localStorage, "ZbynekStravaSegmentInfo.segmentPreferenceDb", 1, null),
		new HtmlWrapper(document)
	)
		.init();

}, false);

// vim: set sw=8 ts=8 noet smarttab:
