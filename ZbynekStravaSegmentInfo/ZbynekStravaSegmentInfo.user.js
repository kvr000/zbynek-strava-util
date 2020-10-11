// ==UserScript==
// @id          https://github.com/kvr000/zbynek-strava-util/ZbynekStravaSegmentInfo/
// @name        Zbynek Strava Segment Info
// @namespace   https://github.com/kvr000/zbynek-strava-util/
// @description Strava - Enhance segment list with detailed segment information, applies to activity page, segment you're looking for page and segment detail page.
// @author      Zbynek Vyskovsky, kvr000@gmail.com https://github.com/kvr000/
// @copyright   2020+, Zbynek Vyskovsky,kvr000@gmail.com (https://github.com/kvr000/zbynek-strava-util/)
// @license     Apache-2.0
// @homepage    https://github.com/kvr000/zbynek-strava-util/
// @homepageURL https://github.com/kvr000/zbynek-strava-util/
// @downloadURL https://raw.githubusercontent.com/kvr000/zbynek-strava-util/master/ZbynekStravaSegmentInfo/ZbynekStravaSegmentInfo.user.js
// @updateURL   https://raw.githubusercontent.com/kvr000/zbynek-strava-util/master/ZbynekStravaSegmentInfo/ZbynekStravaSegmentInfo.user.js
// @supportURL  https://github.com/kvr000/zbynek-strava-util/issues/
// @contributionURL https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=J778VRUGJRZRG&item_name=Support+features+development.&currency_code=CAD&source=url
// @version     1.0.4
// @include     https://www.strava.com/activities/*/potential-segment-matches
// @include     http://www.strava.com/activities/*/potential-segment-matches
// @include     https://strava.com/activities/*/potential-segment-matches
// @include     http://strava.com/activities/*/potential-segment-matches
// @include     http://strava.com/segments/*
// @include     https://strava.com/segments/*
// @include     http://www.strava.com/segments/*
// @include     https://www.strava.com/segments/*
// @include     https://www.strava.com/activities/*
// @include     http://www.strava.com/activities/*
// @include     https://strava.com/activities/*
// @include     http://strava.com/activities/*
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

		static regexValueToNull(regex, str)
		{
			return str == null || regex.test(str) ? null : str;
		}

		static objMap(obj, mapper)
		{
			return obj == null ? null : mapper(obj);
		}

		static escapeRegExp(string) {
			return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
			const url = this.convertTemplate(urlTemplate, placeholders);
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
					(error) => { delete this.pendingPromises[id]; throw error; }
				);
			}
			return Promise.resolve(item);
		}

	}

	class GlobalDbStorageCache extends AbstractCache
	{
		constructor(storage, name, version, expiration, options)
		{
			super(version, expiration);
			this.storage = storage;
			this.name = name;
			this.writebackTimeout = Js.objGetElse(options || {}, 'writebackTimeout', 5000);
			this.itemsToUpdate = {};
			this.pendingWrite = false;
			this.loadDb();
		}

		get(id)
		{
			const item = this.cache[id];
			if (item) {
				if (item.version == this.version && (item.expire == null || item.expire > new Date().getTime())) {
					return item.value;
				}
				delete this.cache[id];
				this.itemsToUpdate[id] = null;
				this.scheduleUpdate();
			}
			return null;
		}

		put(id, value)
		{
			this.itemsToUpdate[id] = this.cache[id] = { expire: this.expiration == null ? null : new Date().getTime()+this.expiration, version: this.version, value: value };
			this.scheduleUpdate();
		}

		scheduleUpdate()
		{
			if (!this.pendingWrite) {
				setTimeout(() => this.doUpdate(), this.writebackTimeout);
				this.pendingWrite = true;
			}
		}

		doUpdate()
		{
			this.loadDb();
			Object.getOwnPropertyNames(this.itemsToUpdate).forEach((key) => {
				if (this.itemsToUpdate[key] !== null) {
				       	this.cache[key] = this.itemsToUpdate[key];
				}
				else {
					delete this.cache[key];
				}
			});
			this.itemsToUpdate = {};
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

		loadDb()
		{
			try {
				this.cache = JSON.parse(this.storage.getItem(this.name));
			}
			catch (err) {
			}
			if (!this.cache) {
				this.cache = {};
			}
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
				const item = JSON.parse(this.storage.getItem(this.constructPath(id)));
				if (item) {
					if (item.version == this.version && (item.expire == null || item.expire > new Date().getTime())) {
						return item.value;
					}
					this.remove(id);
				}
			}
			catch (error) {
			}
			return null;
		}

		put(id, value)
		{
			this.storage.setItem(
				this.constructPath(id),
				JSON.stringify({
					expire: this.expiration == null ? null : new Date().getTime()+this.expiration,
				       	version: this.version,
				       	value: value
				})
			);
		}

		remove(id)
		{
			this.storage.removeItem(this.constructPath(id));
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
		separator = ",";
		quote = '"';

		specialMatch;

		headerMap = null;
		headerIndex = null;
		output = "";

		constructor(options)
		{
			this.separator = Js.objGetElse(options || {}, 'separator', ',');
			this.quote = Js.objGetElse(options || {}, 'quote', '"');
			this.specialMatch = new RegExp("["+Js.escapeRegExp(this.separator)+Js.escapeRegExp(this.quote)+"]");
		}

		setHeader(headerMap)
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
		}

		writeHeader(headerMap)
		{
			this.setHeader(headerMap);
			this.writeArray(Object.getOwnPropertyNames(this.headerIndex).map((key) => this.headerMap[key]));
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
			this.output += row.map((item) => this.formatItem(item)).join(this.separator)+"\n";
		}

		getOutput()
		{
			return this.output;
		}

		formatItem(item)
		{
			let str = item == null ? "" : String(item);
			if (this.specialMatch.test(str)) {
				str = this.quote+str.replace(this.quote, this.quote+this.quote)+this.quote;
			}
			return str;
		}
	}

	class ZbynekStravaSegmentInfoUiBase
	{
		// TODO: Some split into strict UI and general support classes would be nice, for now simple split from original single purpose UI

		/* constants */
		static PR_MATCH = /^\s*\u21b5?\s*-?\s*((\d+:)*\d+)\s*\u21b5?\s*$/;
		static TIME_MATCH = /^((((\d+)d\s*)?(\d+):)?(\d+):)?(\d+)$/;
		static TIME_ABBR_MATCH = /^((\d+:)*\d+)(|s)(<abbr.*)?$/;
		static LEVELS = {
			"": "",
			1: "L1 (Always)",
			2: "L2 (Relax)",
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
			14: "Rebuilt",
			15: "Wrong",
			16: "Uninteresting",
		};
		static CSV_ROW_HEADER = {
			name: "Name",
			level: "Level",
			done: "Done",
			stat: "Stat",
			distance: "Distance",
			place: "Place",
			orientation: "Orientation",
			direction: "Direction",
			note: "Note",
			protect: "Protect",
			time: "Time",
			url: "Url",
		};

		/* dependencies */
		ajaxService;
		segmentInfoCache;
		segmentPreferenceDb;
		dwrapper;

		donateUrl = "https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=J778VRUGJRZRG&item_name=Support+future+development.&currency_code=CAD&source=url";

		constructor(ajaxService, segmentInfoCache, segmentPreferenceDb, documentWrapper)
		{
			this.ajaxService = ajaxService;
			this.segmentInfoCache = segmentInfoCache;
			this.segmentPreferenceDb = segmentPreferenceDb;
			this.dwrapper = documentWrapper;
		}

		updatePreference(segmentFull)
		{
			this.segmentPreferenceDb.put(segmentFull.segment.info.id, segmentFull.preference);
		}

		convertTimeStr(timeStr)
		{
			if (!timeStr)
				return null;
			const group = timeStr.match(ZbynekStravaSegmentInfoUiBase.TIME_MATCH);
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
			return ZbynekStravaSegmentInfoUiBase.LEVELS[Js.strNullToEmpty(Js.objMap(level, String))];
		}

		writeCsvSegment(csvFormatter, segmentFull)
		{
			const segment = segmentFull.segment;
			const preference = segmentFull.preference;
			csvFormatter.writeMapped({
				name: segment.info.name,
				level: this.formatLevel(preference.level),
				done: Js.objMap(segment.pr.date, this.formatDate),
				stat: segment.isKqom ? "KOM" : null,
				distance: segment.info.distance,
				protect: preference.protect,
				time: segment.pr.time != null ? this.formatTimeHms(segment.pr.time) : null,
				url: segment.info.url,
			});
		}

		updateEffortData(segmentInfo, root)
		{
			let updated = false;

			const bestDetails = [ JSON.parse(root.evaluate("//div[@data-react-class = 'SegmentDetailsSideBar']/@data-react-props", root, null, XPathResult.STRING_TYPE).stringValue).sideBarProps]
				.flatMap(a => [ a.fastestTimes, { pr: a.viewingAthlete } ])
				.flatMap(a => Object.values(a))
				.filter(rec => rec.stats)
				.reduce((result, rec) => {
					return {
						...result,
						...rec.stats.reduce((obj, e) => { return /^(KOM|QOM|All-Time PR)$/.test(e.label) ? { ...obj, [e.label]: { time_str: e.value?.match(ZbynekStravaSegmentInfoUiBase.TIME_ABBR_MATCH)?.[1], rec: rec } } : obj }, {}),
					}
				}, {});

			const prTime_str = Js.nullElseGet(Js.strEmptyToNull(root.evaluate("//div[contains(concat(' ', @class), ' AvatarWithDataRow--call-out-row-')]//*[div[text() = 'All-Time PR']]/div[contains(concat(' ', @class), ' AvatarWithDataRow--call-out-effort-')]/text()", root, null, XPathResult.STRING_TYPE).stringValue.match(ZbynekStravaSegmentInfoUiBase.PR_MATCH)?.[1]),
				() => Js.strEmptyToNull(bestDetails['All-Time PR']?.time_str));
			const prLink = Js.nullElseGet(Js.strEmptyToNull(root.evaluate("//div[contains(concat(' ', @class), ' AvatarWithDataRow--call-out-row-') and .//div[text() = 'All-Time PR']]/div[contains(concat(' ', @class), ' AvatarWithDataRow--call-out-date-')]/a/@href", root, null, XPathResult.STRING_TYPE).stringValue),
				() => Js.objMap(bestDetails['All-Time PR']?.rec, (rec) => rec.activityId ? "/activities/"+rec.activityId+"#"+rec.segmentEffortId : null));
			const prDate_str = Js.nullElseGet(Js.strEmptyToNull(root.evaluate("//div[contains(concat(' ', @class), ' AvatarWithDataRow--call-out-row-') and .//div[text() = 'All-Time PR']]/div[contains(concat(' ', @class), ' AvatarWithDataRow--call-out-date-')]/a/text()", root, null, XPathResult.STRING_TYPE).stringValue),
				() => bestDetails['All-Time PR']?.rec?.date);;
			const komTime_str = Js.nullElseGet(Js.strEmptyToNull(root.evaluate("//div[contains(concat(' ', @class), ' AvatarWithDataRow--call-out-row-')]//*[div[text() = 'KOM']]/div[contains(concat(' ', @class), ' AvatarWithDataRow--call-out-effort-')]/text()", root, null, XPathResult.STRING_TYPE).stringValue.match(ZbynekStravaSegmentInfoUiBase.PR_MATCH)?.[1]),
				() => Js.strEmptyToNull(bestDetails['KOM']?.time_str));
			const komLink = Js.nullElseGet(Js.strEmptyToNull(root.evaluate("//div[contains(concat(' ', @class), ' AvatarWithDataRow--call-out-row-') and .//div[text() = 'KOM']]/div[contains(concat(' ', @class), ' AvatarWithDataRow--call-out-date-')]/a/@href", root, null, XPathResult.STRING_TYPE).stringValue),
				() => Js.objMap(bestDetails['KOM']?.rec, (rec) => rec.activityId ? "/activities/"+rec.activityId+"#"+rec.segmentEffortId : null));
			const komDate_str = Js.nullElseGet(Js.strEmptyToNull(root.evaluate("//div[contains(concat(' ', @class), ' AvatarWithDataRow--call-out-row-') and .//div[text() = 'KOM']]/div[contains(concat(' ', @class), ' AvatarWithDataRow--call-out-date-')]/a/text()", root, null, XPathResult.STRING_TYPE).stringValue),
				() => bestDetails['KOM']?.rec?.date);;
			const qomTime_str = Js.nullElseGet(Js.strEmptyToNull(root.evaluate("//div[contains(concat(' ', @class), ' AvatarWithDataRow--call-out-row-')]//*[div[text() = 'QOM']]/div[contains(concat(' ', @class), ' AvatarWithDataRow--call-out-effort-')]/text()", root, null, XPathResult.STRING_TYPE).stringValue.match(ZbynekStravaSegmentInfoUiBase.PR_MATCH)?.[1]),
				() => Js.strEmptyToNull(bestDetails['QOM']?.time_str));
			const qomLink = Js.nullElseGet(Js.strEmptyToNull(root.evaluate("//div[contains(concat(' ', @class), ' AvatarWithDataRow--call-out-row-') and .//div[text() = 'QOM']]/div[contains(concat(' ', @class), ' AvatarWithDataRow--call-out-date-')]/a/@href", root, null, XPathResult.STRING_TYPE).stringValue),
				() => Js.objMap(bestDetails['QOM']?.rec, (rec) => rec.activityId ? "/activities/"+rec.activityId+"#"+rec.segmentEffortId : null));
			const qomDate_str = Js.nullElseGet(Js.strEmptyToNull(root.evaluate("//div[contains(concat(' ', @class), ' AvatarWithDataRow--call-out-row-') and .//div[text() = 'QOM']]/div[contains(concat(' ', @class), ' AvatarWithDataRow--call-out-date-')]/a/text()", root, null, XPathResult.STRING_TYPE).stringValue),
				() => bestDetails['QOM']?.rec?.date);;
			const bestTime_str = Js.strEmptyToNull(root.evaluate("//table[contains(concat(' ', @class, ' '), 'table-leaderboard')]/tbody/tr[1]/td[@class='last-child']/text()", root, null, XPathResult.STRING_TYPE, null).stringValue);
			const bestSpeed_str = Js.strEmptyToNull(root.evaluate("//table[contains(concat(' ', @class, ' '), 'table-leaderboard')]/tbody/tr[1]/td[abbr[text() = 'km/h']]/text()", root, null, XPathResult.STRING_TYPE, null).stringValue);
			const bestBpm_str = Js.strEmptyToNull(Js.regexValueToNull(/^\s*-\s*$/, root.evaluate("//table[contains(concat(' ', @class, ' '), 'table-leaderboard')]/tbody/tr[1]/td[abbr[text() = 'bpm']]/text()", root, null, XPathResult.STRING_TYPE, null).stringValue));
			const bestPowerColumn = Js.objMap(root.evaluate("//table[contains(concat(' ', @class, ' '), 'table-leaderboard')]/thead/tr/th[text() = 'Power']", root, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue, (node) => this.dwrapper.childElementPosition(node));
			const bestPower_str = Js.objMap(bestPowerColumn, (column) => Js.strEmptyToNull(Js.regexValueToNull(/^\s*-\s*$/, root.evaluate("//table[contains(concat(' ', @class, ' '), 'table-leaderboard')]/tbody/tr[1]/td[position() = "+(column+1)+"]/text()", root, null, XPathResult.STRING_TYPE, null).stringValue)));
			const bestVamColumn = Js.objMap(root.evaluate("//table[contains(concat(' ', @class, ' '), 'table-leaderboard')]/thead/tr/th[text() = 'VAM']", root, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue, (node) => this.dwrapper.childElementPosition(node));
			const bestVam_str = Js.objMap(bestVamColumn, (column) => Js.strEmptyToNull(Js.regexValueToNull(/^\s*-\s*$/, root.evaluate("//table[contains(concat(' ', @class, ' '), 'table-leaderboard')]/tbody/tr[1]/td[position() = "+(column+1)+"]/text()", root, null, XPathResult.STRING_TYPE, null).stringValue)));

			const prTime = this.convertTimeStr(prTime_str);
			const prDate = Js.objMap(prDate_str, (str) => Date.parse(str+" UTC"));
			if (prTime != segmentInfo.pr.time || prLink != segmentInfo.pr.link || prDate != segmentInfo.pr.date) {
				segmentInfo.pr.time = prTime;
				segmentInfo.pr.link = prLink;
				segmentInfo.pr.date = prDate;
				updated = true;
			}

			const komTime = this.convertTimeStr(komTime_str);
			const komDate = Js.objMap(komDate_str, (str) => Date.parse(str+" UTC"));
			if (komTime != segmentInfo.kom.time || komLink != segmentInfo.kom.link || komDate != segmentInfo.kom.date) {
				segmentInfo.kom.time = komTime;
				segmentInfo.kom.link = komLink;
				segmentInfo.kom.date = komDate;
				updated = true;
			}

			const qomTime = this.convertTimeStr(qomTime_str);
			const qomDate = Js.objMap(qomDate_str, (str) => Date.parse(str+" UTC"));
			if (qomTime != segmentInfo.qom.time || qomLink != segmentInfo.qom.link || qomDate != segmentInfo.qom.date) {
				segmentInfo.qom.time = qomTime;
				segmentInfo.qom.link = qomLink;
				segmentInfo.qom.date = qomDate;
				updated = true;
			}

			const bestTime = this.convertTimeStr(bestTime_str);
			const bestSpeed = Js.objMap(bestSpeed_str, Number);
			const bestHeartRate = Js.objMap(bestBpm_str, Number);
			const bestPower = Js.objMap(bestPower_str, s => Number(s.replace(",", "")));
			const bestVam = Js.objMap(bestVam_str, s => Number(s.replace(",", "")));
			if (bestTime != segmentInfo.best.time || bestSpeed != segmentInfo.best.speed || bestHeartRate != segmentInfo.best.heartRate || bestPower != segmentInfo.best.power || bestVam != segmentInfo.best.vam) {
				segmentInfo.best.time = bestTime;
				segmentInfo.best.speed = bestSpeed;
				segmentInfo.best.heartRate = bestHeartRate;
				segmentInfo.best.power = bestPower;
				segmentInfo.best.vam = bestVam;
				updated = true;
			}

			const isKqom = prLink != null && (prLink == komLink || prLink == qomLink);
			if (isKqom != segmentInfo.isKqom) {
				segmentInfo.isKqom = isKqom;
				updated = true;
			}

			return updated;
		}

		fetchSegmentFull(segmentId)
		{
			return Promise.all([
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

							const route = JSON.parse(responses[1]);
							const distance = Js.objMap(distance_str, Number);
							const elevationGain = Js.objMap(route, route => route.altitude.reduce((total, current, index, array) => total+(index == 0 ? 0 : Math.max(0, current-array[index-1])), 0));
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
								isKqom: null,
								pr: {
									time: null,
									link: null,
									date: null,
								},
								kom: {
									time: null,
									link: null,
									date: null,
								},
								qom: {
									time: null,
									link: null,
									date: null,
								},
								best: {
									time: null,
									speed: null,
									heartRate: null,
									power: null,
									vam: null,
								},
							};
							this.updateEffortData(segmentInfo, root);
							this.segmentInfoCache.put(segmentId, segmentInfo);
							GM_log(segmentInfo);
							return segmentInfo;
						})
				)
			])
				.then((segmentAll) => {
					return {
						preference: segmentAll[0],
						segment: segmentAll[1],
					};
				});
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
				".zbynek-strava-segment-info-filter > .enablers > .enabler { display: inline-block; width: 24%; }\n"+
				".zbynek-strava-segment-info-filter > .row { width: 100%; display: none; }\n"+
				".zbynek-strava-segment-info-filter > .row > .name { display: inline-block; width: 20%; }\n"+
				".zbynek-strava-segment-info-filter > .row > .content { display: inline-block; width: 80%; }\n"+
				"\n"+
				".zbynek-strava-segment-info-segment-value { font-size: 14px; font-weight: none; }\n"+
				"";
			//GM_addStyle(style);
			this.dwrapper.needXpathNode("//head", this.dwrapper.doc).appendChild(this.dwrapper.createElementEx("style", { type: "text/css" }, [
				this.dwrapper.createTextNode(style)
			]));
		}

	}

	/**
	 * UI for Potential Segment Matcher
	 */
	class ZbynekStravaSegmentInfoMatcherUi extends ZbynekStravaSegmentInfoUiBase
	{
		/* UI */
		menuEl;
		filterEl;

		/* status */
		filterEnabled = false;
		batchUpdateEnabled = false;
		filterFunction = () => true;

		constructor(ajaxService, segmentInfoCache, segmentPreferenceDb, documentWrapper)
		{
			super(ajaxService, segmentInfoCache, segmentPreferenceDb, documentWrapper);
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
					this.fetchSegmentFull(segmentId)
				])
					.then((segmentAll) => {
						const segmentRow = segmentAll[0];
						const segmentFull = segmentAll[1];
						try {
							this.dwrapper.removeXpath("./span[@id='zbynek-strava-segment-info-segment']", segmentRow);
							const segment = segmentFull.segment;
							const preference = segmentFull.preference;
							const infoEl = this.dwrapper.templateElement(
								""+
									"<span id='zbynek-strava-segment-info-segment' class='zbynek-strava-segment-info-segment' pl$-segmentfull='segmentFull' pl$-onchange='emptyFunc'>"+
									"<span class='distance'><pl$-text name='distance_str'></pl$-text>km</span>"+
									"<span class='grade'><pl$-text name='avgGrade_str'></pl$-text>%</span>"+
									"<span class='elevationGain'><pl$-if condition='elevationGain_str'><true><pl$-text name='elevationGain_str'></pl$-text>m</true><false>unknown</false></pl$-if></span>"+
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
									distance_str: Js.objMap(segment.info.distance, n => n.toFixed(2)),
									avgGrade_str: Js.objMap(segment.info.avgGrade, n => n.toFixed(1)),
									elevationGain_str: Js.objMap(segment.info.elevationGain, n => n.toFixed(0)),
									pr_link: Js.nullElse(segment.pr.link, ""),
									pr_time_str: () => this.formatTime(segment.pr.time),
									pr_isKqom_str: segment.isKqom ? "\uD83D\uDC51" : "",
									kqom_link: segment.kom.link,
									kqom_time_str: () => this.formatTime(segment.best.time),
									kqom_speed_str: () => Js.objMap(segment.best.speed, n => n.toFixed(1)),
									kqom_power_str: () => Js.objMap(segment.best.power, n => n.toFixed(0)),
									levelSelect: this.dwrapper.createSelect({ class: "zbynek-strava-inline-select", emptyIsNull: true }, ZbynekStravaSegmentInfoUiBase.LEVELS, preference.level, (value) => {
										segmentFull.preference.level = value;
										this.updatePreference(segmentFull);
									}),
									typeSelect: this.dwrapper.createSelect({ class: "zbynek-strava-inline-select", emptyIsNull: true }, { "": "", road: "Rd", light: "Lgt", gravel: "Gr", mtb: "Mtb" }, preference.type, (value) => {
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
			let csvFormatter = new CsvFormatter({ separator: "\t" });
			csvFormatter.writeHeader(ZbynekStravaSegmentInfoUiBase.CSV_ROW_HEADER);
			this.listVisibleSegments().forEach((segmentRow) => {
				const segmentFull = this.dwrapper.needXpathNode(".//span[@id = 'zbynek-strava-segment-info-segment']", segmentRow).segmentfull;
				this.writeCsvSegment(csvFormatter, segmentFull);
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
					donateUrl: this.donateUrl,
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

	/**
	 * UI for Segment UI
	 */
	class ZbynekStravaSegmentInfoSegmentUi extends ZbynekStravaSegmentInfoUiBase
	{
		/* UI */
		menuEl;
		filterEl;

		/* status */
		filterEnabled = false;
		batchUpdateEnabled = false;
		filterFunction = () => true;

		constructor(ajaxService, segmentInfoCache, segmentPreferenceDb, documentWrapper)
		{
			super(ajaxService, segmentInfoCache, segmentPreferenceDb, documentWrapper);
		}

		getSegmentId()
		{
			return Js.nullElseThrow(
				this.dwrapper.evaluate("//*[contains(concat(' ', @class, ' '), ' segment-name ')]//*[@data-segment-id]/@data-segment-id", this.dwrapper.doc, null, XPathResult.STRING_TYPE).stringValue,
				() => new Error("Failed to identify data-segment-id")
			);
		}

		exportSegmentRow(segmentId)
		{
			Promise.all([
				Promise.resolve(this.getSegmentId()),
				this.fetchSegmentFull(segmentId)
			])
				.then((segmentAll) => {
					const segmentId = segmentAll[0];
					const segmentFull = segmentAll[1];
					let csvFormatter = new CsvFormatter({ separator: "\t" });
					csvFormatter.setHeader(ZbynekStravaSegmentInfoUiBase.CSV_ROW_HEADER);
					this.writeCsvSegment(csvFormatter, segmentFull);
					GM_setClipboard(csvFormatter.getOutput());
					alert("Segment data exported");
				});
		}

		updateSegmentUi()
		{
			Promise.all([
				Promise.resolve(this.getSegmentId()),
				this.fetchSegmentFull(this.getSegmentId())
			])
				.then((segmentAll) => {
					const segmentId = segmentAll[0];
					const segmentFull = segmentAll[1];
					if (this.updateEffortData(segmentFull.segment, document)) {
						this.segmentInfoCache.put(segmentFull.segment.info.id, segmentFull.segment);
					}
					try {
						const segment = segmentFull.segment;
						const preference = segmentFull.preference;
						const addedEls = this.dwrapper.templateElements(
							""+
								"<li id='zbynek-strava-segment-info-segment-elevation-gain'>"+
								"<div class='stat'>"+
								"<span class='stat-subtext'>Elevation Gain</span>"+
								"<b class='stat-text'><pl$-text name='elevationGain_str'></pl$-text><abbr class='unit' title='meters'>m</abbr></b>"+
								"</span>"+
								"</div>"+
								"</li>"+
								"<li id='zbynek-strava-segment-info-segment-level'>"+
								"<div class='stat'>"+
								"<span class='stat-subtext'>Level</span>"+
								"<div class='zbynek-strava-segment-info-segment-value'><pl$-node name='levelSelect'></pl$-node></div>"+
								"</span>"+
								"</div>"+
								"</li>"+
								"<li id='zbynek-strava-segment-info-segment-type'>"+
								"<div class='stat'>"+
								"<span class='stat-subtext'>Type</span>"+
								"<div class='zbynek-strava-segment-info-segment-value'><pl$-node name='typeSelect'></pl$-node></div>"+
								"</span>"+
								"</div>"+
								"</li>"+
								"<li id='zbynek-strava-segment-info-segment-type'>"+
								"<div class='stat'>"+
								"<span class='stat-subtext'>Protect</span>"+
								"<div class='zbynek-strava-segment-info-segment-value'><input type='text' pl$-value='protectValue' pl$-onchange='updateProtect'></input></div>"+
								"</span>"+
								"</div>"+
								"</li>"+
								"<li id='zbynek-strava-segment-info-segment-export'>"+
								"<div class='stat'>"+
								"<span class='stat-subtext'>Export</span>"+
								"<b class='stat-text'><a pl$-onclick='exportFunc'>Export</a></b>"+
								"</span>"+
								"</div>"+
								"</li>"+
								"<li id='zbynek-strava-segment-info-segment-donate'>"+
								"<div class='stat'>"+
								"<span class='stat-subtext'>Zbynek Strava Donate</span>"+
								"<b class='stat-text'><a pl$-href='donateUrl' target='_blank' title='Support further development by donating to project'>Donate</a></b>"+
								"</span>"+
								"</div>"+
								"</li>",
							{
								elevationGain_str: Js.objMap(segment.info.elevationGain, n => n.toFixed(0)),
								levelSelect: this.dwrapper.createSelect({ class: "zbynek-strava-inline-select", emptyIsNull: true }, ZbynekStravaSegmentInfoUiBase.LEVELS, preference.level, (value) => {
									segmentFull.preference.level = value;
									this.updatePreference(segmentFull);
								}),
								typeSelect: this.dwrapper.createSelect({ class: "zbynek-strava-inline-select", emptyIsNull: true }, { "": "", road: "Rd", light: "Lgt", gravel: "Gr", mtb: "Mtb" }, preference.type, (value) => {
									segmentFull.preference.type = value;
									this.updatePreference(segmentFull);
								}),
								protectValue: preference.protect,
								updateProtect: (event) => {
									segmentFull.preference.protect = Js.strEmptyToNull(event.target.value);
									this.updatePreference(segmentFull);
								},
								exportFunc: () => { this.exportSegmentRow(segmentId); },
								donateUrl: this.donateUrl,
							},
							'pl$-'
						);

						const elevationDifferenceEl = this.dwrapper.needXpathNode("//ul[contains(concat(' ', @class, ' '), ' inline-stats ')]/li[.//span[text() = 'Elev Difference']]", this.dwrapper.doc);
						[
							"./span[@id='zbynek-strava-segment-info-segment-elevation-gain']",
							"./span[@id='zbynek-strava-segment-info-segment-level']",
							"./span[@id='zbynek-strava-segment-info-segment-type']",
							"./span[@id='zbynek-strava-segment-info-segment-export']",
							"./span[@id='zbynek-strava-segment-info-segment-donate']",
						].forEach((xpath) => this.dwrapper.removeXpath(xpath, this.dwrapper.doc));
						this.dwrapper.insertMultiAfter(addedEls, elevationDifferenceEl);
					}
					catch (err) {
						GM_log("Failed processing segment: "+segmentId, err);
					}
				});
		}

		initializeUi()
		{
			this.updateSegmentUi();
		}

		init()
		{
			this.initializeStatic();
			this.initializeUi();
		}
	}

	/**
	 * UI for Activity UI
	 */
	class ZbynekStravaSegmentInfoActivityUi extends ZbynekStravaSegmentInfoUiBase
	{
		filterEl = null;

		filterEnabled = false;
		batchUpdateEnabled = false;
		filterFunction = () => true;

		constructor(ajaxService, segmentInfoCache, segmentPreferenceDb, documentWrapper)
		{
			super(ajaxService, segmentInfoCache, segmentPreferenceDb, documentWrapper);
		}

		enrichSegments()
		{
			let counter = 0;
			let processedCounter = 0;
			const effortRows = this.dwrapper.listXpath("//table[contains(concat(' ', @class, ' '), ' segments ') or contains(concat(' ', @class, ' '), ' hidden-segments ')]//tr[@data-segment-effort-id]", this.dwrapper.doc);
			for (let effortIdx in effortRows) {
				const effortRow = effortRows[effortIdx];
				const effortId = effortRow.getAttribute("data-segment-effort-id");
				const segmentId = pageView.segmentEfforts().getEffort(effortId).attributes.segment_id;
				Promise.all([
					Promise.resolve(effortRow),
					this.fetchSegmentFull(segmentId)
				])
					.then((segmentAll) => {
						const effortRow = segmentAll[0];
						const segmentFull = segmentAll[1];
						try {
							const segment = segmentFull.segment;
							const preference = segmentFull.preference;
							const statsEls = this.dwrapper.templateElements(
								""+
									"<span id='zbynek-strava-segment-info-activity-effort-avgGrade'> <pl$-if condition='avgGrade_str'><true><pl$-text name='avgGrade_str'></pl$-text><abbr class='unit' title='percent'>%</abbr></true><false>unknown</false></pl$-if></span>"+
									"<span id='zbynek-strava-segment-info-activity-effort-elevationGain'>gain: <pl$-if condition='elevationGain_str'><true><pl$-text name='elevationGain_str'></pl$-text><abbr class='unit' title='meters'>m</abbr></true><false>unknown</false></pl$-if></span>"+
									"<span id='zbynek-strava-segment-info-activity-effort-pr'><pl$-if condition='prTime_str'><true><pl$-text name='prTime_str'></pl$-text><abbr class='unit' title='s'>s</abbr></true><false>none</false></pl$-if></span>"+
									"<span id='zbynek-strava-segment-info-activity-effort-best'><br/>best: <span id='time'><pl$-if condition='bestTime_str'><true><pl$-text name='bestTime_str'></pl$-text><abbr class='unit' title='s'>s</abbr></true><false>unknown</false></pl$-if></span> <span id='speed'><pl$-if condition='bestSpeed_str'><true><pl$-text name='bestSpeed_str'></pl$-text><abbr class='unit' title='km/h'>km/h</abbr></true><false>unknown</false></pl$-if></span> <span id='power'><pl$-if condition='bestPower_str'><true><pl$-text name='bestPower_str'></pl$-text><abbr class='unit' title='watts'>W</abbr></true><false>unknown</false></pl$-if></span></span>",
								{
									avgGrade_str: Js.objMap(segment.info.avgGrade, n => n.toFixed(1)),
									elevationGain_str: Js.objMap(segment.info.elevationGain, n => n.toFixed(0)),
									prTime_str: Js.objMap(segment.pr?.time, n => this.formatTime(n)),
									bestPower_str: Js.objMap(segment.best?.power, n => n.toFixed(0)),
									bestSpeed_str: Js.objMap(segment.best?.speed, n => n.toFixed(1)),
									bestTime_str: Js.objMap(segment.best?.time, n => this.formatTime(n)),
								},
								'pl$-'
							);
							const updatesEls = this.dwrapper.templateElements(
								""+
									"<td id='zbynek-strava-segment-info-activity-effort-updates'>"+
									"<pl$-node name='levelSelect'></pl$-node>"+
									"<pl$-node name='typeSelect'></pl$-node>"+
									"</td>",
								{
									levelSelect: this.dwrapper.createSelect({ class: "zbynek-strava-inline-select", emptyIsNull: true }, ZbynekStravaSegmentInfoUiBase.LEVELS, preference.level, (value) => {
										preference.level = value;
										this.updatePreference(segmentFull);
									}),
									typeSelect: this.dwrapper.createSelect({ class: "zbynek-strava-inline-select", emptyIsNull: true }, { "": "", road: "Rd", light: "Lgt", gravel: "Gr", mtb: "Mtb" }, preference.type, (value) => {
										preference.type = value;
										this.updatePreference(segmentFull);
									}),
								},
								'pl$-'
							);
							[
								".//span[@id='zbynek-strava-segment-info-activity-effort-avgGrade']",
								".//span[@id='zbynek-strava-segment-info-activity-effort-elevationGain']",
								".//span[@id='zbynek-strava-segment-info-activity-effort-pr']",
								".//span[@id='zbynek-strava-segment-info-activity-effort-best']",
								".//td[@id='zbynek-strava-segment-info-activity-effort-updates']",
							].forEach((xpath) => this.dwrapper.removeXpath(xpath, effortRow));
							const origAvgGradeEl = this.dwrapper.needXpathNode(".//span[@title = 'Average grade']", effortRow);
							const visibilityEl = this.dwrapper.needXpathNode(".//td[.//button[contains(concat(' ', @class, ' '), 'toggle-effort-visibility')]]", effortRow);
							this.dwrapper.insertMultiAfter(statsEls, origAvgGradeEl);
							this.dwrapper.insertMultiBefore(updatesEls, visibilityEl);
							this.dwrapper.setVisible(origAvgGradeEl, false);
							if (this.dwrapper.setVisible(effortRow, this.filterFunction(preference, segment), "table-row"))
								++processedCounter;
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
			const effortRows = this.dwrapper.listXpath("//table[contains(concat(' ', @class, ' '), ' segments ') or contains(concat(' ', @class, ' '), ' hidden-segments ')]//tr[@data-segment-effort-id]", this.dwrapper.doc);
			return effortRows.map((effortRow) => pageView.segmentEfforts().getEffort(effortRow.getAttribute("data-segment-effort-id")).attributes.segment_id);
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
			let failed = 0;
			Promise.allSettled(this.listVisibleSegments().map((segmentId) => {
				this.fetchSegmentFull(segmentId)
					.then((segmentFull) => {
						let newPreference;
						try {
							newPreference = batchFunction(segmentFull.preference, segmentFull.segment);
						}
						catch (error) {
							if (failed++ == 0) {
								alert("Failed to execute batch update: "+error);
							}
							throw error;
						}
						Object.assign(segmentFull.preference, newPreference);
						this.updatePreference(segmentFull);
					});
			}))
				.then((results) => {
					results.filter((result) => result.status == 'rejected').forEach((result) => console.log(result));
					this.enrichSegments();
				});
		}

		initializeUi()
		{
			const segmentFooterEl = this.dwrapper.needXpathNode("//*[@id = 'segments']/footer", this.dwrapper.doc);
			this.filterEl = this.dwrapper.templateElement(
				""+
					"<div class='zbynek-strava-segment-info-filter'>\n"+
					"	<div class='enablers'>\n"+
					"		<span class='enabler'>JS Filter <input type='checkbox' pl$-onchange='toggleJsFilter'></input></span>\n"+
					"		<span class='enabler'>Batch Update<input type='checkbox' pl$-onchange='toggleBatchUpdate'></input></span>\n"+
					"		<span class='enabler'><input type='button' value='Update' pl$-onclick='refreshFunc'></input></span>\n"+
					"		<span class='enabler'><a pl$-href='donateUrl' target='_blank' title='Support further development by donating to project'>Donate</a></span>\n"+
					"	</div>\n"+
					"	<div class='row' id='filter'><span class='name' title='JsFilter by JavaScript function'>JS Filter</span><span class='content'><textarea rows='10' class='zbynek-strava-max-width'></textarea></span></div>\n"+
					"	<div class='row' id='batchUpdate'><span class='name' title='Batch update by JavaScript function'><div>JS Batch Update</div><div><input type='button' value='Execute' pl$-onclick='runUpdateFunc'></input></div></span><span class='content'><textarea rows='10' class='zbynek-strava-max-width'></textarea></span></div>\n"+
					"</div>",
				{
					donateUrl: this.donateUrl,
					toggleJsFilter: (event) => this.filterEnabled = this.dwrapper.setVisible(this.dwrapper.needXpathNode("../../../div[@id = 'filter']", event.target), event.target.checked),
					toggleBatchUpdate: (event) => this.batchUpdateEnabled = this.dwrapper.setVisible(this.dwrapper.needXpathNode("../../../div[@id = 'batchUpdate']", event.target), event.target.checked),
					refreshFunc: (event) => this.refreshContent(),
					runUpdateFunc: (event) => this.runBatchUpdate(),
				},
				"pl$-"
			);
			segmentFooterEl.appendChild(this.filterEl);
		}

		init()
		{
			this.initializeStatic();
			this.initializeUi();
		}
	}

	if (/^\/activities\/\w+(|\/segments\/\w+)\/potential-segment-matches\/?$/.test(window.location.pathname)) {
		new ZbynekStravaSegmentInfoMatcherUi(
			new GmAjaxService(),
			new GlobalDbStorageCache(window.localStorage, "ZbynekStravaSegmentInfo.segmentInfoCache", 1, 10*86400*1000),
			new GlobalDbStorageCache(window.localStorage, "ZbynekStravaSegmentInfo.segmentPreferenceDb", 1, null),
			new HtmlWrapper(document)
		)
			.init();
	}
	else if (/^\/segments\/\w+\/?$/.test(window.location.pathname)) {
		new ZbynekStravaSegmentInfoSegmentUi(
			new GmAjaxService(),
			new GlobalDbStorageCache(window.localStorage, "ZbynekStravaSegmentInfo.segmentInfoCache", 1, 10*86400*1000),
			new GlobalDbStorageCache(window.localStorage, "ZbynekStravaSegmentInfo.segmentPreferenceDb", 1, null, { writebackTimeout: 1 }),
			new HtmlWrapper(document)
		)
			.init();
	}
	else if (/^\/activities\/\w+(\/?|\/overview|\/segments\/\w+\/?)$/.test(window.location.pathname)) {
		new ZbynekStravaSegmentInfoActivityUi(
			new GmAjaxService(),
			new GlobalDbStorageCache(window.localStorage, "ZbynekStravaSegmentInfo.segmentInfoCache", 1, 10*86400*1000),
			new GlobalDbStorageCache(window.localStorage, "ZbynekStravaSegmentInfo.segmentPreferenceDb", 1, null, { writebackTimeout: 5000 }),
			new HtmlWrapper(document)
		)
			.init();
	}
	else {
		GM_log("Failed to match URL to known pattern, ignoring: "+window.location.pathname);
	}

}, false);

// vim: set sw=8 ts=8 noet smarttab:
