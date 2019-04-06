/*
    Windows Live Calendar Gadget
    Gadget for displaying of calendars in ical format.

    By Zbynek Poulicek (poulicek@gmail.com), October 2009.
    Copyright (C) 2009 - Zbynek Poulicek.
    All rights reserved.
    
    http://wlcalendargadget.codeplex.com/
*/



// Colors based on users aero color (assigned only if aero* skin is loaded)
var gAlphaShader;
var gBaseColor;
var gLighterColor;
var gLightestColor;
var gDarkerColor;
var gDarkestColor;
var gInvertedColor;

var gShown;
var gWlCalendar;
var gAdodbStream;
var gFileSystemObject;
var gShellObject;
var gActualDate;
var gNextDate;
var gSources;
var gDownloaded;
var gDownloadedCnt;
var gUpdateTimer;
var gAlarmTimout;
var gAlarmSound;
var gActualEventsStartIndex;
var gActualEventsLimit;
var gActualEventsLimitDays;
var gActualEventsDate;
var gActiveDateElement;
var gCalendarDate;
var gCachePath;
var gLastTimeVisible;
var gNotices;
var gUseReminder;
var gPersistentSettings;
var gIcsCacheLength;


// Load event handler
function onLoadGadget()
{
	// init objects
	gCachePath = System.Gadget.path + '\\cache.ics';
	gWlCalendar = new wlCalendar();
	gShellObject = new ActiveXObject("Wscript.Shell");
	gFileSystemObject = new ActiveXObject("Scripting.FileSystemObject");
 	
 	// detecting if the name days have to be shown
	if (gShellObject.RegRead("HKEY_CURRENT_USER\\Control Panel\\International\\Geo\\Nation") != 75)
		document.gNameDays = null;

	// init handlers
	System.Gadget.Flyout.file = 'detail.html';
	System.Gadget.settingsUI = 'settings.html';
	System.Gadget.onDock = onDock;
	System.Gadget.onUndock = onUndock;
 	System.Gadget.onSettingsClosed = onSettingsClosed;
	System.Gadget.visibilityChanged = onVisibilityChanged;

	// loading the user settings
 	loadSettings();

	// loading the cache
	if (gFileSystemObject.FileExists(gCachePath))
	{
	    var icsCache = readFile(gCachePath);
	    if (icsCache.length == gIcsCacheLength)
			gWlCalendar.load(icsCache);
	}

	// raising the onShown event
	setTimeout(onShown, 50);

	// setting dock state when Vista sidebar is used
	if (System.Gadget.platformVersion < "1.0.70001.1.0")
    	return System.Gadget.docked ? onDock() : onUndock();
}


// Shown event handler
function onShown()
{
	gShown = true;
	setBodyHeight();
}


// Dock event handler
function onDock()
{
	System.Gadget.Flyout.show = false;
 	calendar.style.display = "none";
	redraw(true);
}


// Undock event handler
function onUndock()
{
	System.Gadget.Flyout.show = false;
 	calendar.style.display = "";
  	redraw(true);
}


// Visibility changed event handler
function onVisibilityChanged()
{
	if (System.Gadget.visible)
	{
		if (!gLastTimeVisible)
		{
			if (gShown)
				redraw();
				
	  		checkForNewVersion();
	  		gLastTimeVisible = true;
			setUpdateTimer(parseInt(readSettings('updateInterval', '5')));
		}
   	}
   	else
   	{
		setUpdateTimer();
		gWlCalendar.clearEventProgressTimers();
		gLastTimeVisible = false;
	}
}


// Clicking on event handler
function onShowEventDetail(eventIndex)
{
	if (System.Gadget.Flyout.show && System.Gadget.Flyout.document.gDetailEventIndex == eventIndex)
		System.Gadget.Flyout.show = false;
	else
	{
		if (System.Gadget.Flyout.show)
			drawDetail(eventIndex);
		else
		{
			System.Gadget.Flyout.onShow = function() { drawDetail(eventIndex); };
			System.Gadget.Flyout.show = true;
	    }
	    System.Gadget.Flyout.document.gDetailEventIndex = eventIndex;
    }
}


// Timer handler
function onUpdate(showErrors)
{
 	// setting of actual date
 	gActualDate = null;
	gActualDate = new Date();

	// creating a container for downloads
	var session = gActualDate.getTime();
	gDownloadedCnt = gSources.length;
	gDownloaded = [];
	gDownloaded[session] = [];

  	for (var i = 0; i < gSources.length; i++)
    	readFile(gSources[i], onDownload, session, i, showErrors);
}


// File download event handler
function onDownload(contents, session, index)
{
	if (!gDownloaded || !gDownloaded[session] || gDownloaded[session][index])
	    return;

	if (!contents.match(/END:VCALENDAR\s*$/i))
	{
		contents = '';
		error(document.gTexts["loadError"] + ':\n' + gSources[index]);
	}

	if (gSources[index].match(/reg$/))
	    contents = 'BEGIN:REGULAR\n' + contents;

	gDownloaded[session][index] = contents;
	if (!(--gDownloadedCnt))
	{
		setBodyHeight();
		var icalData = gDownloaded[session].join('\n');
		gDownloaded = null;

		if (icalData && icalData != gWlCalendar.rawData)
		{
		    try
		    {
		    	gIcsCacheLength = icalData.length;
		    	System.Gadget.Settings.writeString('cacheLength', gIcsCacheLength);
				writeToFile(gCachePath, icalData);
			} catch (e) { }

			gWlCalendar.load(icalData);
			gActualEventsStartIndex = 0;
			redraw();
		}
		else if (eventListContent.firstChild && eventListContent.firstChild.className == "message")
			redraw();
	}
}


// Slide up event handler
function onSlideEventsUp()
{
	if (eventListNavigationUp.className != "navigationUpInactive" && gActualEventsStartIndex > 0)
	{
		gActualEventsStartIndex--;
		drawEventList();
	}
}


// Slide down event handler
function onSlideEventsDown()
{
	if (eventListNavigationDown.className != "navigationDownInactive")
	{
		gActualEventsStartIndex++;
		drawEventList();
	}
}


// Click on the date event handler
function onDateClick(dateElement, dateString)
{
	// hiding the detail of an event
	System.Gadget.Flyout.show = false;

	// setting of selected date
	gActualEventsStartIndex = 0;
	gActualEventsDate = dateString ? new Date(dateString) : null;

	// highliting of selected date on calendar
	if (gActiveDateElement)
  		gActiveDateElement.className = gActiveDateElement.className.replace(" activeDate", "");
    gActiveDateElement = dateElement;
    gActiveDateElement.className += " activeDate";

    // drawing of nameday (if available)
    drawNameDay(gActualEventsDate);
    
	// drawing of appropriate eventlist
	drawEventList();
}


/////////////////////////////////////////////////////////////////////////////////////////


// Load settings handler
function onLoadSettings()
{
	System.Gadget.onSettingsClosing = onSettingsClosing;

	// setting of sources
	sourcesLabel.innerText = System.Gadget.document.gTexts["sources"] + ":";
	sources.innerText = readSettings('sources', '').replace(/;/g, '\n');

	// setting of udpate interval
	updateIntervalLabel.innerText = System.Gadget.document.gTexts["updateInterval"] + ":";
	updateInterval.value = readSettings('updateInterval', '5');

	// hack for hidding the invalid carret
	updateInterval.focus();
 	updateInterval.blur();

	// setting of limit of displayed events
	limitLabel.innerText = System.Gadget.document.gTexts["limit"] + ":";
	limit.value = readSettings('limit', '4');
	
	// setting of limit of days for display of the event list
	limitDaysLabel.innerText = System.Gadget.document.gTexts["limitDays"] + ":";
	limitDays.value = readSettings('limitDays', '7');
	
	// setting the reminder checkbox
	var reminderValue = readSettings('reminder', null);
	reminderLabel.innerText = System.Gadget.document.gTexts["useReminder"] + ":";
	reminder.checked = !reminderValue || !parseInt(reminderValue);
	
	// setting of sound of alarm
	var alarmSoundValue = readSettings('alarmSound', null);
	alarmSoundLabel.innerText = System.Gadget.document.gTexts["alarmSound"] + ':';
	alarmSound.innerText = alarmSoundValue ? alarmSoundValue : (new ActiveXObject("Wscript.Shell")).ExpandEnvironmentStrings("%WINDIR%") + "\\media\\Windows Notify.wav";

	// load skin setting
	var skin = readSettings('skin', null);
	if (!skin)
	    skin = 'Midnight 2'

	// create list of available skins
	//skin = skin.toLowerCase().replace(/\s+$/, '');
	skinsLabel.innerText = System.Gadget.document.gTexts["skins"] + ":";
	var dir = System.Shell.itemFromPath(System.Gadget.path + '\\skins').SHFolder;
	for (var i = 0; i < dir.Items.count; i++)
	{
		if (dir.Items.item(i).isFolder && dir.Items.item(i).name != '.svn')
		{
		    var option = document.createElement("OPTION");
		    option.innerText = option.value = dir.Items.item(i).name;
		    option.name = "skin";
		    option.selected = skin.toLowerCase() == option.innerText.toLowerCase();
		    skins.appendChild(option);
      	}
    }
}


// Settings closing handler
function onSettingsClosing(e)
{
	if (e.closeAction == e.Action.commit)
	{
	    // serialization of sources
	    var sourcesValue = sources.innerText.replace(/(\r?\n\s*)+/g, ';');

        // trimming the white spaces
        sourcesValue = sourcesValue.replace(/\s/g, '');

	    // changing the not working webcal protocol to http
	    sourcesValue = sourcesValue.replace(/(webcal|webcals):/g, 'http:');

	    // adding the http prior the www
	    sourcesValue = sourcesValue.replace(/^www./g, 'http://www.');

	    // switching to https protocol for windows live calendars
	    sourcesValue = sourcesValue.replace(/(http:)([a-z0-9-\/.]*calendar\.live\.com[^;]*)/g, 'https:$2');
	    
	    //sourcesValue = sourcesValue.replace(/(webcal)([a-z0-9-\/:.]*calendar\.live\.com[^;]*)/g, 'http$2')
	    //sourcesValue = sourcesValue.replace(/(webcals)([a-z0-9-\/:.]*calendars\.office\.microsoft\.com[^;]*)/g, 'http$2')

    	// save settings
    	var values = [];
    	values['sources'] = sourcesValue;
    	values['updateInterval'] = updateInterval.value.length && updateInterval.value >= 0 ? updateInterval.value : 5;
    	values['limit'] = limit.value > 0 ? limit.value : 4;
    	values['limitDays'] = limitDays.value > 0 ? limitDays.value : 7;
    	values['reminder'] = reminder.checked ? 0 : 1;
    	values['alarmSound'] = alarmSound.innerText ? alarmSound.innerText : (new ActiveXObject("Wscript.Shell")).ExpandEnvironmentStrings("%WINDIR%") + "\\media\\Windows Notify.wav";

	 	var skinElements = skins.getElementsByTagName('option');
    	for (var i = 0; i < skinElements.length; i++)
      		if (skinElements[i].selected)
        		values['skin'] = skinElements[i].value;
        		
    	writeSettings(values);
    	writeINI(System.Gadget.path + '\\..\\WLCalendarSettings.ini', values);
    }

    // accept event
    e.cancel = false;
}


// Setting closed handler
function onSettingsClosed(e)
{
    if (e.closeAction != e.Action.commit)
        return;

	loadSettings();
	if (gSources.length)
		drawMessage(document.gTexts["loading"]);
	else
	    redraw();
		
	setUpdateTimer(readSettings('updateInterval'), true);
}

/////////////////////////////////////////////////////////////////////////////////////////

// Load settings handler
function onLoadDetail()
{
	// applying a skin
	var skin = 	readSettings('skin', null);
	applySkin(skin ? skin : 'Midnight 2', 'detail');
}


/////////////////////////////////////////////////////////////////////////////////////////


// Checks for updates
function checkForNewVersion()
{
	var callBack = function(contents)
	{
	    var items = contents.split(/<item>\s*<title>Released:/);
	    if (items.length <= 1)
	        return;
	        
	    var version = System.Gadget.Settings.readString('version');
	    var pubDate = items[1].match(/<pubDate>([^<]*)/)[1];

	    if (!version.length)
	        System.Gadget.Settings.writeString('version', pubDate);
	    else if (pubDate != version)
        	drawNotice('newVersion', '<a href="http://wlcalendargadget.codeplex.com/">' + document.gTexts["updateAvailable"] + '</a>', function() { System.Gadget.Settings.writeString('suppressUpdate', 1); });
	}

	var suppressNotification = System.Gadget.Settings.readString('suppressUpdate');
	if (!suppressNotification)
		readFile('https://wlcalendargadget.codeplex.com/project/feeds/rss?ProjectRSSFeed=codeplex%3a%2f%2frelease%2fwlcalendargadget', callBack);
}

// Reads settings
function readSettings(name, defValue)
{
	var value = System.Gadget.Settings.readString(name);
	if (value)
		return value;

	if (!gPersistentSettings)
    	gPersistentSettings = readINI(System.Gadget.path + '\\..\\WLCalendarSettings.ini');

	value = gPersistentSettings[name];
	if (value != null && value != 'undefined')
	{
		System.Gadget.Settings.writeString(name, value);
		return value;
	}

 	return defValue;
}


// Reads settings
function writeSettings(values)
{
	for (var key in values)
	    System.Gadget.Settings.writeString(key, values[key]);
}


// Parses the ini file
function readINI(path)
{
	var result = [];
	if (!gFileSystemObject)
		gFileSystemObject = new ActiveXObject("Scripting.FileSystemObject");
		
  	if (!gFileSystemObject.FileExists(path))
  		return result;

	var lines = readFile(path).split(/\r?\n/);
	for (var i = 0; i < lines.length; i++)
	{
		if (lines[i].length > 0)
		{
		    var values = lines[i].split(/\s*=\s*/);
		    result[values.shift()] = values.join('=');
	    }
	}
	return result;
}

// Writes the ini file
function writeINI(path, values)
{
	var result = '';
	for (var key in values)
	    result += key + '=' + values[key] + '\r\n';
	writeToFile(path, result);
}


// Loads user settings
function loadSettings()
{
	// applying a skin
	applySkin(readSettings('skin', 'Midnight 2'), 'main');

	// setting the sound of alarm
	gAlarmSound = readSettings('alarmSound', gShellObject.ExpandEnvironmentStrings("%WINDIR%") + "\\media\\Windows Notify.wav");

	// setting the number of displaying events
	var limit = parseInt(readSettings('limit', '4'));
	if (limit > gActualEventsLimit)
		gActualEventsStartIndex = 0;
	gActualEventsLimit = limit;
	
	// setting the usage of external reminder
	var reminder = readSettings('reminder', null);
	gUseReminder = !reminder || !parseInt(reminder);
		
	// setting the number of limit days for event list
	gActualEventsLimitDays = parseInt(readSettings('limitDays', '7'));

	// loading the desired length of the ics file
	gIcsCacheLength = parseInt(readSettings('cacheLength', '0'));
	
	// loading the sources of calendars
	if (!(gSources = readSettings('sources', '').split(';'))[0])
		gSources.pop();

	// deleting the cache if no calendars are set
	if (!gSources.length)
	{
	    if (gFileSystemObject.FileExists(gCachePath))
	    {
			gFileSystemObject.DeleteFile(gCachePath);
			gWlCalendar = null;
			gWlCalendar = new wlCalendar();
		}

  		// clearing the update timer
		if (gUpdateTimer)
			clearInterval(gUpdateTimer);
	}
}


// Sets the height of the body
function setBodyHeight(documentElement)
{
	if (!documentElement)
		document.body.style.height = layout.offsetHeight + "px";
	else
 		documentElement.body.style.height = documentElement.getElementById("layout").offsetHeight + "px";
}


// Redraws whole calendar
function redraw(reset)
{
	// setting of actual date
	gNextDate = gActualDate = null;
	gActualDate = new Date();
	gNextDate = new Date(gActualDate.getFullYear(), gActualDate.getMonth(), gActualDate.getDate() + 1);

	// Resets the view presets
	if (reset || !gCalendarDate)
	{
	 	setBodyHeight();
		gActualEventsDate = null;
		gActualEventsStartIndex = 0;

		if (!System.Gadget.docked)
		{
			gActiveDateElement = null;
   			gCalendarDate = null;
			gCalendarDate = new Date(gActualDate.toDateString());
			gCalendarDate.setDate(1);
		}
	}

	// drawing the gadget
	if (!System.Gadget.docked)
		drawCalendar();
	drawNoticeList();
	drawNameDay();
	drawEventList();

	// setting of next alarm
	setNextAlarm();
}


// Draws the list of registered notices
function drawNoticeList()
{
	if (!gNotices)
		return;
        
	var html = '';
	for (var key in gNotices)
	    if (gNotices[key])
			html += '<span onclick="gNotices[\'' + key +'\'][1](); gNotices[\'' + key + '\'] = false; redraw()" class="dismiss">&times;</span>' + gNotices[key][0];

	notices.innerHTML = html;
	notices.style.display = html.length ? '' : 'none';
}


// Draws a notice above the eventlist
function drawNotice(id, value, callback)
{
	if (!gNotices)
		gNotices = [];

	if (gNotices[id] == null)
		gNotices[id] = [value, callback ? callback : function(){}];
		
	redraw();
}

// Draws detail of an event
function drawDetail(eventIndex)
{
	// setting the content
 	System.Gadget.Flyout.document.getElementById("content").innerHTML = gWlCalendar.getEventDetailHtml(eventIndex);
	setBodyHeight(System.Gadget.Flyout.document);
}


// Returns if the events are visible in the calendar
function eventsVisible(events)
{
	for (var i = 0; i < events.length; i++)
	    if (!events[i].regular)
	        return true;
	 return false;
}


// Draws a list of events
function drawEventList()
{
	if (!System.Gadget.docked)
	    preview.style.display = "none";
	else
	{
	    var tmpDate = new Date(gActualDate.toDateString());
	    for (var i = 0; i < 7; i++)
	    {
	    	document.getElementById("previewHeading" + i).innerText = vbsWeekDayName(tmpDate.getDay() % 7).substring(0, 2);
	    
	    	var dayEl = document.getElementById("previewDay" + i);
	    	var events = gWlCalendar.getEvents(tmpDate);
			dayEl.className = !eventsVisible(events) ? "" : (gWlCalendar.isStarting(tmpDate.toDateString()) ? " event" : " oldEvent");
			dayEl.innerHTML = tmpDate.getDate();
			
			// moving to the next day
			tmpDate.setDate(tmpDate.getDate() + 1);
	    }
	    document.getElementById("previewDay0").className = 'today' + document.getElementById("previewDay0").className;
	    preview.style.display = "";
	}

    var eventsHtml = gWlCalendar.getEventsHtml(gActualEventsStartIndex, gActualEventsLimit, "onShowEventDetail", !gActualEventsDate ? gActualDate : gActualEventsDate, System.Gadget.docked ? 0 : gActualEventsLimitDays);
    if (!eventsHtml || !eventsHtml[0])
    {
    	if (!System.Gadget.docked)
    		eventListNavigation.style.display = eventListContent.style.display = "none";
    	else
    		drawMessage(document.gTexts[gSources == null || !gSources.length ? "noSources" : "noEvents"]);
    }
    else
	{
		eventListContent.innerHTML = eventsHtml[0];
  		eventListNavigation.style.display = eventListContent.style.display = "";
		eventListNavigationUp.className = gActualEventsStartIndex ? "" : "navigationUpInactive";
		eventListNavigationDown.className = eventsHtml[1] ? "" : "navigationDownInactive";
	}
	setBodyHeight();
}


// Draws a message instead of eventlist
function drawMessage(message)
{
	eventListContent.innerHTML = '<div class="message">' + message + '</div>';
	eventListNavigation.style.display = "none";
	eventListContent.style.display = "";
	setBodyHeight();
}


// Gets the number of week (thanks to Tommy Skaue, http://www.codeproject.com/KB/cs/gregorianwknum.aspx)
function getWeekByDate(determinedate)
{
    var D = determinedate.getDay();
    if(D == 0) D = 7;
    determinedate.setDate(determinedate.getDate() + (4 - D));
    var YN = determinedate.getFullYear();
    var ZBDoCY = Math.floor((determinedate.getTime() - new Date(YN, 0, 1, -6)) / 86400000);
    var WN = 1 + Math.floor(ZBDoCY / 7);
    return WN;
}


// Draws a calendar
function drawCalendar(shiftMonth)
{
	// hiding the detail of an event
	System.Gadget.Flyout.show = false;
	
	if (shiftMonth)
	    gCalendarDate.setMonth(gCalendarDate.getMonth() + shiftMonth);

	// setting of the name of the month
	var monthName = vbsMonthName(gCalendarDate.getMonth() + 1);
	month.innerText = monthName.charAt(0).toUpperCase() + monthName.substring(1);

	// setting of the year
	year.innerHTML = gActualDate.getFullYear() != gCalendarDate.getFullYear() ? gCalendarDate.getFullYear() : '<span style="display: none">' + gCalendarDate.getFullYear() + '</span>';

	// setting of headings
	var firstDayIndex = vbsFirstDayOfWeekIsMon() ? 1 : 0;
	var dayIndex = firstDayIndex;
	for (var i = 0; i < 7; i++)
	    document.getElementById("heading" + i).innerText = vbsWeekDayName(dayIndex++ % 7).substring(0, 2);

	// setting of initial date for drawing
	var firstDayValue = !gCalendarDate.getDay() && firstDayIndex ? 7 : gCalendarDate.getDay();
	var tmpDate = new Date(gCalendarDate.getYear(), gCalendarDate.getMonth(), firstDayIndex - firstDayValue + 1);
	
	// setting of week numbers
	for (var i = 0; i < 6; i++)
		document.getElementById("weekNumber" + i).innerText = getWeekByDate(new Date(tmpDate.getFullYear(), tmpDate.getMonth(), tmpDate.getDate() + 1 + i * 7));

	// setting of days
	lastRow.style.display = "";
	var today = gActualDate.toDateString();
	for (var i = 0; i < 42; i++)
	{
		var isToday = today == tmpDate.toDateString();
		var dayEl = document.getElementById("day" + i);
		dayEl.className = "";
		dayEl.innerHTML = '<a href="javascript:void(0)" onfocus="this.blur()" onclick="onDateClick(this.parentNode' + (isToday ? "" : ", '" + tmpDate.toDateString() + "'") + ')">' + tmpDate.getDate() + '</a>';

		// detecting the type of the day
		if (isToday)
        	dayEl.className = "today";

		// detecting the previous and next month
		if (tmpDate < gCalendarDate)
			dayEl.className += " previousMonth";
  		else if (tmpDate.getMonth() != gCalendarDate.getMonth())
  		{
			dayEl.className += " nextMonth";
  		    if (i == 34)
            	lastRow.style.display = "none";
        }
		
		// setting of the event
		var events = gWlCalendar.getEvents(tmpDate);
		if (eventsVisible(events))
		{
			dayEl.className += gWlCalendar.isStarting(tmpDate.toDateString()) ? " event" : " oldEvent";
			for (var j = 0; j < events.length; j++)
				if (events[j].properties.containsKey("SUMMARY"))
			    	dayEl.firstChild.title += events[j].getProperty("SUMMARY") + "\n";
		}

		// higliting of selected day
		if ((!gActualEventsDate && isToday) || (gActualEventsDate && tmpDate.toDateString() == gActualEventsDate.toDateString()))
		{
			gActiveDateElement = dayEl;
			dayEl.className += " activeDate";
			drawNameDay(tmpDate);
		}

		// moving to the next day
		tmpDate.setDate(tmpDate.getDate() + 1);
	}
	setBodyHeight();
}


// Draws a nameday
function drawNameDay(date)
{
	if (document.gNameDays)
	{
		if (!date)
			date = gActualDate;
		nameDay.innerHTML = '<span id="nameDayLabel">' + document.gTexts["nameDayLabel"] + ': </span>' + document.gNameDays[(date.getMonth() + 1) + "-" + date.getDate()];
	}
}


/////////////////////////////////////////////////////////////////////////////////////////


// Apply the current skin
function applySkin(skin, name)
{
	if (skin.substring(0, 4).toLowerCase() == 'aero')
		setBaseColor();
	
	// find document head section
	var head = document.getElementsByTagName('head')[0];

	// remove all stylesheets
	var stylesheets = document.getElementsByTagName('link');
	for (var i = 0; i < stylesheets.length; i++)
    	head.removeChild(stylesheets[i]);

	// add custom (skin) stylesheet
	link = document.createElement('link');
	link.href = 'skins/' + skin + '/' + name + '.css';
	link.rel = 'stylesheet';
	link.type = 'text/css';
	head.appendChild(link);

	// resize body
	if (window.content)
		setBodyHeight();
}


// Pads the number by 0 (from the beginning)
function pad(num, totalChars)
{
	while (num.length < totalChars)
 		num = '0' + num;
	return num;
}


// Changes the color by ratio which is between 0 and 1
function changeColor(color, ratio, darker)
{
    var arguments = color.match(/^#?([a-z0-9][a-z0-9])([a-z0-9][a-z0-9])([a-z0-9][a-z0-9])$/i);
    var decimal = [parseInt(arguments[1], 16), parseInt(arguments[2], 16), parseInt(arguments[3], 16)];

	return darker ?
		pad(Math.floor(ratio * decimal[0]).toString(16), 2) + pad(Math.floor(ratio * decimal[1]).toString(16), 2) + pad(Math.floor(ratio * decimal[2]).toString(16), 2) :
		pad(Math.min(decimal[0] + Math.floor(ratio * (255 - decimal[0])), 255).toString(16), 2) + pad(Math.min(decimal[1] + Math.floor(ratio * (255 - decimal[1])), 255).toString(16), 2) + pad(Math.min(decimal[2] + Math.floor(ratio * (255 - decimal[2])), 255).toString(16), 2);
}


// Changes the color to be more contrastive
function saturateColor(color)
{
	var arguments = color.match(/^#?([a-z0-9][a-z0-9])([a-z0-9][a-z0-9])([a-z0-9][a-z0-9])$/i);
	var decimal = [parseInt(arguments[1], 16), parseInt(arguments[2], 16), parseInt(arguments[3], 16)];
	
	return pad(Math.floor(0.8 * decimal[1]).toString(16)) + pad(Math.floor(0.6 * decimal[1]).toString(16)) + pad(Math.floor(0.4 * decimal[2]).toString(16))
}


// Lighters the color
function lighterColor(color, ratio)
{
 	return changeColor(color, ratio, false);
}


// Darkers the color
function darkerColor(color, ratio)
{
	return changeColor(color,  1 - ratio, true);
}


// Sests the base color according to current aero color
function setBaseColor()
{
	var color = (new ActiveXObject("Wscript.Shell")).RegRead("HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\DWM\\ColorizationColor").toString(16);
	var ratio = 1 - (color.length > 8 ?  255 - parseInt(color.substring(1, 3), 16) : parseInt(color.substring(0, 2), 16)) / 255;

	gBaseColor = lighterColor(color.length > 8 ?  (16777216 - parseInt(color.substring(3), 16)).toString(16) : color.substring(2), ratio);
	gLightestColor = lighterColor(gBaseColor, 0.7);
	gLighterColor = darkerColor(gBaseColor, 0.35);
	gDarkerColor = darkerColor(gBaseColor, 0.5);
	gDarkestColor = darkerColor(gBaseColor, 0.65);
	gInvertedColor = saturateColor(gBaseColor);
}


/////////////////////////////////////////////////////////////////////////////////////////


// Reads contents of file
function readFile(path, callback, session, index, showErrors)
{
	try
	{
		// checks if path is web url
		if ((/^[^\/]+:[\/]{2}/).test(path))
		{
        	// encoding the path if needed
			var url = path.indexOf('%') < 0 ? encodeURI(path) : path;

  			// if session is generated, its added to the request url in order to prevent windows to use cache
			if (session && (path.indexOf('calendar.live.com') > 0 || path.indexOf('wunderground.com') > 0 || path.indexOf('google.com') > 0))
				url += (path.indexOf('?') >= 0 ? '&' : '?') + session;

            // setting the download wrapper
            // url = 'http://wlcalendargadget.com/dl.php?url=' + encodeURIComponent(url);

			var xmlHttp = new XMLHttpRequest();
		    if (callback)
		    {
			    xmlHttp.onreadystatechange = function()
				{
				    try
				    {
				    	if (this.readyState == 4)
				    	{
				    		var status = parseInt(this.status);
				    	    if (status == 200)
				    	    	callback(this.responseText, session, index);
							else if (status == 0 && path.substring(0, 5) == 'http:')
								return readFile(path.replace('http', 'https'), callback, session, index, showErrors);
							else if (showErrors)
							{
								if (status != 200)
									error(document.gTexts["loadError"] + ' (' + status + '):\n' + path);
								redraw();
							}
							xmlHttp = null;
						}
					}
					catch(e) { }
				};

				// async calling
                xmlHttp.open("GET", url, true);
				xmlHttp.setRequestHeader("Content-type", "text/plain");
				//xmlHttp.setRequestHeader("Cache control", "no-cache");
	    	    xmlHttp.send(null);
			}
			else
			{
				// sync calling
		        xmlHttp.open("GET", url, false);
		        xmlHttp.setRequestHeader("Content-type", "text/plain");
				//xmlHttp.setRequestHeader("Cache control", "no-cache");
		    	xmlHttp.send(null);
		    	return xmlHttp.responseText;
	    	}
	    }
		else
		{
			// gets contents from a local file
			if (!gAdodbStream)
				gAdodbStream = new ActiveXObject("ADODB.Stream");
			gAdodbStream.Open();
			gAdodbStream.CharSet = "UTF-8";
			gAdodbStream.LoadFromFile(path);
			var contents = gAdodbStream.ReadText();
			gAdodbStream.Close();

			if (callback)
				callback(contents, session, index);
			else
				return contents;
		}
	}
	catch(e)
	{
		if (showErrors)
			alarm(document.gTexts["loadError"] + ': "' + path + '"');
		
		if (gAdodbStream && gAdodbStream.State == 1)
		    gAdodbStream.Close();
	}
}


// Writes contents to file
function writeToFile(path, contents)
{
	if (!gAdodbStream)
		gAdodbStream = new ActiveXObject("ADODB.Stream");
				
	// writes contents to a local file
	gAdodbStream.Open();
	gAdodbStream.CharSet = "UTF-8";
	gAdodbStream.WriteText(contents);
	gAdodbStream.SaveToFile(path, 2);
	gAdodbStream.Close();
}


/////////////////////////////////////////////////////////////////////////////////////////


// Sets the next alarm event
function setNextAlarm()
{
	var events, nextRefreshEvents = [], nextRefreshDate = gNextDate, timeoutLimit = gNextDate - gActualDate + 1209600001;
	if (events = gWlCalendar.events)
	{
		if (!gWlCalendar.nextStartDatesSet)
	    	gWlCalendar.setNextStartDates();
		for (var i = 0; i < events.length; i++)
		{
		    var event = events[i];
		    
		    var exDates = event.properties.containsKey('EXDATE') ? event.getProperty('EXDATE') : '';
			if (exDates.indexOf(new Date(event.actualStartDate.toDateString())) >= 0)
				continue;
				
		    if (event.actualStartDate - gActualDate > timeoutLimit)
				break;
					
			if (gActualDate <= event.actualEndDate)
			{
				var eventMinimalDate = getMinimalDate(event);
	        	if (!nextRefreshDate || eventMinimalDate <= nextRefreshDate)
	        	{
	        	    if (eventMinimalDate < nextRefreshDate)
	        	    	nextRefreshEvents = [];
	        	    	
	          		nextRefreshDate = eventMinimalDate;
	          		nextRefreshEvents.push(event);
	          	}
          	}
		}
	}

	// clearing of active alarm and setting the new one
	if (gAlarmTimout)
		clearTimeout(gAlarmTimout);
	gAlarmTimout = setTimeout( function() { onEventAlarm(nextRefreshEvents, nextRefreshDate); }, nextRefreshDate - gActualDate);
}


// Gets the minimal date of the event
function getMinimalDate(event)
{
	if (event.alarm)
	{
		var eventAlarmDate = new Date(event.actualStartDate);
		eventAlarmDate.setSeconds(eventAlarmDate.getSeconds() + event.getAlarmProperty("TRIGGER"));

		if (eventAlarmDate > gActualDate)
		    return eventAlarmDate;
	}
	return event.actualStartDate > gActualDate ? event.actualStartDate : event.actualEndDate;
}


// Pop-ups the alarm message
function alarm(content)
{
	//System.Sound.playSound(gAlarmSound);
	vbsAlert(content, 64, "Windows Live Calendar Gadget");
}


// Pop-ups the alarm message
function error(content)
{
	//System.Sound.playSound(gShellObject.ExpandEnvironmentStrings("%WINDIR%") + "\\media\\Windows Critical Stop.wav");
	vbsAlert(content, 16, "Windows Live Calendar Gadget");
}


// Sets the update timer
function setUpdateTimer(interval, showErrors)
{
	if (gUpdateTimer)
	    clearInterval(gUpdateTimer);

	if (gSources != null && gSources.length)
	{
		onUpdate(showErrors);
		if (interval > 0)
			gUpdateTimer = window.setInterval(onUpdate, interval * 60000);
	}
}


// Alarm event handler
function onEventAlarm(events, date)
{
	// running alarms
	for (var i = 0; i < events.length; i++)
	{
	    var event = events[i];
	    if (event.alarm && (date < event.actualStartDate || event.getAlarmProperty("TRIGGER") == '0'))
		{
			if (gUseReminder && gFileSystemObject.FileExists(System.Gadget.path + '\\WLCalendarReminder.exe'))
	    		gShellObject.run('"' + System.Gadget.path + '\\WLCalendarReminder.exe" "' + event.getProperty("SUMMARY") + '" ' + Math.round(event.actualStartDate / 1000) + ' "' + gAlarmSound + '"');
	    	else
       			alarm(event.getProperty("SUMMARY") + '\n\n' + document.gTexts['start'] + ': ' + event.actualStartDate.toLocaleString() + '\n' + document.gTexts['end'] + ': ' + event.actualEndDate.toLocaleString());
	    }
	}
	
	// changing of date
	if (date.toTimeString().match(/0:00:00/))
		return redraw(true);

	// redrawing the gadget if the date didn't change
    gActualEventsStartIndex = 0;
    redraw();
}

/////////////////////////////////////////////////////////////////////////////////////////


// Object of calendar holding actual set of events
function wlCalendar()
{
	this.iCalReader = new iCalReader();
	this.iCalendar;
 	this.events;
	this.sortedEvents;
	this.repeatedEvents;
 	this.rawData;
 	this.actualDate;
 	this.eventProgressTimers;
 	this.notificationEvent;
 	this.nextStartDatesSet;


	// Loads a calendar data in ical format
	this.load = function(rawIcalData)
	{
	    // parsing the data
		this.iCalReader.prepareData(rawIcalData);
		this.iCalReader.parse();
		this.iCalReader.data = null;
		this.rawData = null;
		this.nextStartDatesSet = false;

		// initializing of properties
  		this.rawData = rawIcalData;
		this.iCalendar = this.iCalReader.getCalendar();
  		this.events = this.filterInvalidEvents(this.iCalendar.getEvents());

		if (!this.events.length)
		  return;
      
		// sorting of events
		this.sortedEvents = [];
		this.repeatedEvents = [];
		for (var i = 0; i < this.events.length; i++)
		{
			var event = this.events[i];
			event.actualStartDate = new Date(event.getStartDate());
			event.actualEndDate = new Date(event.getEndDate());

			if (event.getRuleProperties().size)
   			{
			    this.repeatedEvents.push(event);
       			event.cachedStartDates = [];
    			continue;
			}

			var isStarting = true;
			var cmpDate = new Date(event.actualStartDate.toDateString());
			do
			{
				this.setEvent(cmpDate.toDateString(), event, isStarting);
				cmpDate.setDate(cmpDate.getDate() + 1);
				isStarting = false;
			} while(cmpDate < event.actualEndDate);
		}
		this.sortEvents(this.events);
	}
	
	
	// Sorts the events by start date
	this.sortEvents = function(events)
	{
        events.sort(function(a, b)
        {
            var ad = a.actualStartDate - a.regular;
            var bd = b.actualStartDate - b.regular;
            return ad < bd ? -1 : (ad > bd ? 1 : 0);
        });
	}

	
	// Gets the number of repetations by applying frequency rules
	this.getRepetationCnt = function(eventStartDate, rrules, interval, refDate)
	{
		var count = rrules["COUNT"] ? parseInt(rrules["COUNT"]) : -1;
		if (!count)
	        return -1;

		// Checking the UNTIL attribute
		if (rrules["UNTIL"])
		{
			var until = this.iCalReader.toDate(rrules["UNTIL"]);
			if (until.getHours())
				until.setHours(24);
			if (until < refDate)
			    return -1;
		}

		var pass = 0;
		var baseDate = new Date(eventStartDate.toDateString());
		
		switch (rrules["FREQ"])
	    {
			case "DAILY" :
				pass = Math.floor((refDate - baseDate)  / 86400000 / interval);
				break;

			case "WEEKLY" :
				pass = Math.floor((refDate - baseDate)  / 604800000 / interval);
				break;

			case "MONTHLY" :
				pass = Math.floor(((refDate.getMonth() - baseDate.getMonth()) + 12 * (refDate.getFullYear() - baseDate.getFullYear())) / interval);
				break;

			case "YEARLY" :
				pass = Math.floor((refDate.getFullYear() - baseDate.getFullYear()) / interval)
				break;
	    }

	    if (count > 0 && pass > count)
	        return -1;
	        
		return pass;
	}
	
	
	// Returns the event start dates after the given number of repetations
	this.getRelevantDates = function(eventStartDate, rrules, interval, repeatCnt, exDates)
	{
		var count = rrules["COUNT"] ? parseInt(rrules["COUNT"]) : -1;
		if (repeatCnt < 0 || (count >= 0 && repeatCnt >= count))
	        return;

		// setting the correct date
     	var baseDate = new Date(eventStartDate);
		switch (rrules["FREQ"])
	    {
			case "DAILY" :
				baseDate.setDate(eventStartDate.getDate() + repeatCnt * interval);
				break;

			case "WEEKLY" :
				baseDate.setDate(eventStartDate.getDate() + repeatCnt * interval * 7);
				break;

			case "MONTHLY" :
				baseDate.setMonth(eventStartDate.getMonth() + repeatCnt * interval);
				break;

			case "YEARLY" :
				baseDate.setFullYear(eventStartDate.getFullYear() + repeatCnt * interval);
				break;
	    }

		var resultDates = [];

  	    // applies the byday rule
		if (!rrules['BYDAY'])
		{
		    if (!exDates || exDates.indexOf(new Date(baseDate.toDateString())) < 0)
				resultDates.push(baseDate);
		}
  		else
		{
			var bydayRules = rrules['BYDAY'].split(',');
			if (count >= 0 && repeatCnt * bydayRules.length >= count)
				return;
			
			for (var i = 0; i < bydayRules.length; i++)
			{
				var values = (/(-?[0-9]*)?([A-Z][A-Z])/).exec(bydayRules[i]);
      			var refDayIndex = ("SUMOTUWETHFRSA").indexOf(values[2]) / 2;
      			var resultDate = new Date(baseDate);
         		var index = !values[1] ? 1 : parseInt(values[1]);

				if (!values[1] && rrules['BYSETPOS'])
					index = parseInt(rrules['BYSETPOS']);

	    		switch (rrules["FREQ"])
			    {
			    	case "YEARLY" :
			    	    if (rrules['BYMONTH'])
					    	resultDate.setMonth(rrules['BYMONTH'] - 1);
					    
					case "MONTHLY" :
					    // setting the first day of the week defined by index
						if (index > 0)
							resultDate.setDate(index * 7 - 6);
						else
						{
						    // setting the last day in the month
							resultDate.setMonth(resultDate.getMonth() + 1);
							resultDate.setDate((index + 1) * 7);
						}
						break;
			    }

			    var actDayIndex = resultDate.getDay();
			    if (index > 0)
			    	resultDate.setDate(resultDate.getDate() + (actDayIndex <= refDayIndex ? refDayIndex - actDayIndex : 7 - actDayIndex + refDayIndex));
			    else
			    	resultDate.setDate(resultDate.getDate() - (actDayIndex >= refDayIndex ? actDayIndex - refDayIndex : 7 - refDayIndex + actDayIndex));

				if (!exDates || exDates.indexOf(new Date(resultDate.toDateString())) < 0)
       				resultDates.push(resultDate);
			}
		}

		// Adds the start date of the event (the start date doesn't have to agree with the BYDAY rule)
		if (!repeatCnt && resultDates.join().indexOf(eventStartDate) < 0 && (!exDates || exDates.indexOf(new Date(eventStartDate.toDateString())) < 0))
		    resultDates.push(eventStartDate);

		return resultDates.sort(function(a, b) { return a == b ? 0 : (a > b ? 1 : -1) });
	}
	

	// Sets the next start date of event according to rrule
	this.setNextStartDates = function()
	{
	    if (!this.repeatedEvents)
	        return;

		for (var i=0; i < this.repeatedEvents.length; i++)
		{
      		var event = this.repeatedEvents[i];
			this.resetActualDates(event);
			
			var eventStartDate = event.getStartDate();
			var rrules = event.getRuleProperties().properties;
			var interval = rrules['INTERVAL'] ? parseInt(rrules['INTERVAL']) : 1;

			// getting the initial number of repetations
			var repeatCnt = this.getRepetationCnt(eventStartDate, rrules, interval, gActualDate);
			if (repeatCnt < 0)
       			continue;
      		
			var exDates = event.properties.containsKey('EXDATE') ? event.getProperty('EXDATE') : '';
			do
			{
			    // caching of start dates
	    		if (!event.cachedStartDates[repeatCnt])
					event.cachedStartDates[repeatCnt] = this.getRelevantDates(eventStartDate, rrules, interval, repeatCnt, exDates);

				// getting the relevant dates after repeatCnt repetations
				var startDates = event.cachedStartDates[repeatCnt];
				if (!startDates)
					break;
				else
				{
					// searching for the next date
					for (var j = 0; j < startDates.length; j++)
		     	    {
		     	        //if (event.actualEndDate.getTime() + startDates[j].getTime() - event.actualStartDate.getTime() < gActualDate.getTime())
						//	break;

      					this.setStartDate(event, startDates[j], repeatCnt);
						if (event.actualEndDate > gActualDate)
						{
							startDates = null;
							break;
						}
					}
				}
				repeatCnt++;
			} while (startDates);
		}
		this.sortEvents(this.events);
		this.nextStartDatesSet = true;
	}
	
	
	// Returns the event start date after applying rrule
	this.getStartDates = function(event, refDate)
	{
		var eventStartDate = event.getStartDate();
		var rrules = event.getRuleProperties().properties;
		var interval = rrules['INTERVAL'] ? parseInt(rrules['INTERVAL']) : 1;

		var repeatCnt = this.getRepetationCnt(eventStartDate, rrules, interval, refDate);
		if (repeatCnt < 0)
			return;
			
		// caching of start dates
		if (!event.cachedStartDates[repeatCnt])
			event.cachedStartDates[repeatCnt] = this.getRelevantDates(eventStartDate, rrules, interval, repeatCnt, event.properties.containsKey('EXDATE') ? event.getProperty('EXDATE') : '');
			
  		return [event.cachedStartDates[repeatCnt], repeatCnt];
	}


	// Sets the start date to event
	this.setStartDate = function(event, startDate, repeatCnt)
	{
		event.actualStartDate.setTime(startDate.getTime());
		event.actualEndDate.setTime(event.getEndDate().getTime() - event.getStartDate().getTime() + startDate.getTime());
		event.repeatCnt = repeatCnt;
	}
	
	
	// Resets the actual dates properties
	this.resetActualDates = function(event)
	{
		event.actualStartDate.setTime(event.getStartDate().getTime());
		event.actualEndDate.setTime(event.getEndDate().getTime());
		event.repeatCnt = 0;
	}
	
	
	// Sets the event into sorted events list
	this.setEvent = function(dateString, event, isStarting)
	{
		if (!this.sortedEvents[dateString])
		{
			this.sortedEvents[dateString] = [];
			this.sortedEvents[dateString]["events"] = [];
		}
		if (isStarting)
			this.sortedEvents[dateString]["isStarting"] = true;
        this.sortedEvents[dateString]["events"].push(event);
	}
	
	
	// Returns all events
	this.getAllEvents = function()
	{
		if (!this.nextStartDatesSet)
			this.setNextStartDates();
		return this.events;
	}
	
	
	// Returns events according to date
	this.getEvents = function(refDate)
	{
		var dateString = refDate.toDateString();
		var result = this.sortedEvents && this.sortedEvents[dateString] ? this.sortedEvents[dateString]["events"] : [];

		if (this.repeatedEvents)
	    {
		    var repeatingEvents = []
		    for (var i = 0; i < this.repeatedEvents.length; i++)
	     	{
	     	    var event = this.repeatedEvents[i];
	     	    this.resetActualDates(event);
			
	     	    var startDatesStruct = this.getStartDates(event, refDate);
	     	    if (startDatesStruct && startDatesStruct[0])
	     	    {
	     	    	var startDates = startDatesStruct[0];
	     	    	
	     	        // testing if the event occures in refDate
		     	    for (var j = 0; j < startDates.length; j++)
		     	    {
						this.setStartDate(event, startDates[j], startDatesStruct[1]);
						if (new Date(event.actualStartDate.toDateString()) <= refDate && event.actualEndDate > refDate)
						{
							repeatingEvents.push(event);
							break;
						}
					}
				}
			}
			result = result.concat(repeatingEvents);
			this.sortEvents(result);
			this.nextStartDatesSet = false;
		}
		
		return result
	}
	
	// filters duplicit events
	this.filterInvalidEvents = function(events)
	{
		if (events.length == 0)
			return events;

		// clearing the duplicate events
		var result = [];
		for (var i = 0; i < events.length; i++)
		{
			var eventA = events[i]
			var rrules = eventA.getRuleProperties();
		    if (rrules.size && rrules.containsKey("UNTIL") && this.iCalReader.toDate(rrules.getProperty("UNTIL")) < eventA.getStartDate())
				continue;

            result.push(eventA);
		    if (eventA == null || eventA.calendarType.indexOf('Google') < 0 || !eventA.properties.containsKey('UID'))
				continue;
		    
			for (var j = 0; j < events.length; j++)
			{
				var eventB = events[j];
			    if (j == i || eventB == null|| !eventB.properties.containsKey('UID'))
			        continue;

				// handling the identical events
				if (eventA.getProperty('UID') == eventB.getProperty('UID'))
				{
					if (eventA.getProperty('LAST-MODIFIED') < eventB.getProperty('LAST-MODIFIED'))
					{
					    if (eventA.getRuleProperties().size)
							eventA.setProperty('EXDATE', (eventA.properties.containsKey('EXDATE') ? eventA.getProperty('EXDATE') + ';' : '') + new Date(eventB.getStartDate().toDateString()));
				    }
				    else
				    {
					    if (eventB.getRuleProperties().size)
							eventB.setProperty('EXDATE', (eventB.properties.containsKey('EXDATE') ? eventB.getProperty('EXDATE') + ';' : '') + new Date(eventA.getStartDate().toDateString()));
					}
				}
			}
		}
		
	    return result;
	}
	
	
	// Returns if the starting event exists
	this.isStarting = function(dateString)
	{
	    return this.sortedEvents && this.sortedEvents[dateString] && this.sortedEvents[dateString]["isStarting"];
	}


	// Returns if the event durates whole day
	this.isWholeDayEvent = function(event)
	{
	    if (event.actualStartDate.toTimeString().substring(0, 8) == "00:00:00")
	        return (event.actualEndDate - event.actualStartDate) % 86400000 == 0;
		return false;
	}
	
	
	// Gets the string of date in proper format
	this.getDateString = function(relativeDate, cmpDate)
	{
        if (!cmpDate)
		  cmpDate = new Date(gNextDate);
		
		// gActualDate is today so it returns the time only
		var timeString = relativeDate.toLocaleTimeString().replace(/:00( [AP]M)?$/, "$1");
        if ((/^([0:]+|12[0:]+ AM)$/).test(timeString))
            timeString = '';

        // returning the today value
        if (relativeDate < cmpDate)
            return timeString ? timeString : document.gTexts["today"];

		// gActualDate is tomorow so it returns the string of tromorow
		cmpDate.setDate(cmpDate.getDate() + 1);
		if (relativeDate < cmpDate)
		    return '<span class="eventDatePart">' + document.gTexts["tomorow"] + '</span><span class="eventTimePart" style="display: none">' + timeString + '</span>';

		// returns the name of the day in a week
		cmpDate.setDate(cmpDate.getDate() + 5);
		if (relativeDate < cmpDate)
		    return '<span class="eventDatePart">' + vbsWeekDayName(relativeDate.getDay()) + '</span><span class="eventTimePart" style="display: none">' + timeString + '</span>';

		// returns the date without year
		return '<span class="eventDatePart">' + relativeDate.toLocaleDateString().replace(/[,]?[0-9 ]+$/, "") + '</span><span class="eventTimePart" style="display: none">' + timeString + '</span>';
	}
	
	
	// Returns the progressbar
	this.getEventProgressBarHtml = function(event)
	{
		// setting the callback function for shifting the progressbar
		var onEventProgress = function()
		{
		    var eventEl = document.getElementById("event" + event.id);
		    if (eventEl && eventEl.previousSibling && eventEl.previousSibling.className == 'eventProgressBar')
		        eventEl.previousSibling.style.width = (parseInt(eventEl.previousSibling.style.width) + 1) + '%';
		}

		var interval = (event.actualEndDate - event.actualStartDate) / 100;
		this.eventProgressTimers.push(window.setInterval(onEventProgress, interval));
		return '<div class="eventProgressBar" style="width: ' + Math.floor((gActualDate - event.actualStartDate) / interval) + '%"></div>';
	}
	
	
	// Clears the timers for updating of progressbars
	this.clearEventProgressTimers = function()
	{
	    if (this.eventProgressTimers)
	    	for (var i = 0; i < this.eventProgressTimers.length; i++)
	        	clearInterval(this.eventProgressTimers[i])
	        	
		this.eventProgressTimers = [];
	}


	// Returns a html code of events
	this.getEventsHtml = function(startIndex, limit, onDetailHandler, refDate, limitDays)
	{
	    this.clearEventProgressTimers();

		var getTodayEvents = gActualDate.toDateString() == refDate.toDateString();
		var events = getTodayEvents ? this.getAllEvents() : this.getEvents(refDate);
		if (!events || !events.length)
			return;

		this.actualDate = getTodayEvents ? null : refDate;
		limitDays = getTodayEvents ? limitDays : 1;

		var event;
  		var result = "";
		var lastDate = limitDays ? new Date(refDate.getYear(), refDate.getMonth(), refDate.getDate() + limitDays) : null;
        var prevDateString;
		var nextRefDate = new Date(refDate.getYear(), refDate.getMonth(), refDate.getDate() + 1);

		var i = 0;
		for (i; i < events.length && limit; i++)
		{
			event = events[i];

			var exDates = event.properties.containsKey('EXDATE') ? event.getProperty('EXDATE') : '';
			if (exDates.indexOf(new Date(event.actualStartDate.toDateString())) >= 0)
				continue;

			// checking if the event is not to much in the future
			if (lastDate && event.actualStartDate >= lastDate)
			    return [result, false];

		    if (event.actualEndDate > refDate && --startIndex < 0)
		    {
		        //if (event.regular && getTodayEvents && event.actualStartDate > refDate)
				//	continue;
		        
		    	var startDate = event.actualStartDate;
		    	var endDate = new Date(event.actualEndDate);

		    	// correcting of event end date for display
				if ((/^([0:]+|12[0:]+ AM)$/).test(endDate.toLocaleTimeString()))
    				endDate.setDate(endDate.getDate() - 1);

       			// setting of className
				var eventClassName = startDate <= gActualDate && getTodayEvents ? "activeEvent" : (startDate < nextRefDate ? "todayEvent" : "futureEvent");
				if (event.repeatCnt != null)
				    eventClassName += ' repeatingEvent';

				// getting the code for progressBar
				var progressBar = !event.regular && eventClassName.indexOf("activeEvent") >= 0 && event.actualStartDate < event.actualEndDate ? this.getEventProgressBarHtml(event) : '';
				
				// setting of next event date
				var dateString;
				if (!getTodayEvents)
				 	dateString = startDate < refDate ? ".. " + endDate.toLocaleDateString().replace(/[,]?[0-9 ]+$/, "") : this.getDateString(startDate, new Date(nextRefDate));
    			else
                {
                    var tmpDate = startDate.toDateString();
                    if (tmpDate != gActualDate.toDateString() && tmpDate != prevDateString)
                        result += '<div class="eventCategory" style="display: none">' + this.getDateString(startDate) + '</div>';
                    prevDateString = tmpDate;
					dateString = startDate <= gActualDate ? ".. " + this.getDateString(endDate) : this.getDateString(startDate);
                }

		    	result += progressBar + '<div class="eventColor' + (event.regular ? '' : ' eventColor' + event.calendarIndex) + '"></div><a onfocus="this.blur()" id="event' + event.id + '" class="event ' + eventClassName  + (event.regular ? ' eventRegular' : '') + '" href="javascript:' + onDetailHandler + '(' + i + ')"><div class="summary">' + event.getProperty("SUMMARY") + '</div><div class="eventDate">' + dateString + '</div></a>';
		    	limit--;
		    }
		}
			
		return [result, i < events.length && (!lastDate || events[i].actualStartDate < lastDate)];
	}


	// Return a html code of an event detail
	this.getEventDetailHtml = function(eventIndex)
 	{
 	    var event = this.actualDate ? this.getEvents(this.actualDate)[eventIndex] : this.getAllEvents()[eventIndex];
		var startDate = event.actualStartDate;
		var endDate = new Date(event.actualEndDate);
		
		// correcting of event end date for display
  		if ((/^([0:]+|12[0:]+ AM)$/).test(endDate.toLocaleTimeString()))
			endDate.setDate(endDate.getDate() - 1);

		with(document)
		{
            var link = this.getCalendarLink(event);
	    	var result = link == null ? '' : '<a id="linkButton" onfocus="this.blur()" href="' + link + '"></a>';
			result += '<p class="header_summary"><span class="label">' + gTexts["summary"] + ':</span>' + this.toHtml(event.getProperty("SUMMARY")) + (event.repeatCnt ? '<span class="repetation">(' + event.repeatCnt + '.)</span>' : '') + "</p>";
		    result += event.properties.containsKey("LOCATION") && event.getProperty("LOCATION").length ? '<p><span class="label">' + gTexts["location"] + ':</span>' + this.toHtml(event.getProperty("LOCATION")) + '<a id="showOnMap" title="' + gTexts["showOnMap"] + '" href="http://maps.google.com/?q=' + event.getProperty("LOCATION").replace(/\\+/g, '') + '">&nbsp;</a></p>' : "";

		    if (!event.isNotification)
		    {
		    	// setting of event dates
			    if (this.isWholeDayEvent(event))
			    {
			    	result += '<hr /><p class="header_date_start"><span class="label">' + gTexts["start"] + ':</span>' + startDate.toLocaleDateString() + "</p>";
			    	if (startDate < endDate)
			    		result += '<p class="header_date_end"><span class="label">' + gTexts["end"] + ':</span>' + endDate.toLocaleDateString() + "</p>";
			    }
			    else
				{
				    result += '<hr /><p class="header_date_start"><span class="label date">' + gTexts["start"] + ':</span>' + startDate.toLocaleString().replace(/ ([0-9]?[0-9]:[0-9]{2})(:00)?(:[0-9]{2})?( [AP]M)?$/, ' <span class="eventTime">$1<span class="eventTimeDetails">$3 $4</span></span>') + "</p>";
				    if (startDate < endDate)
				    	result += '<p class="header_date_end"><span class="label date">' + gTexts["end"] + ':</span>' + endDate.toLocaleString().replace(/ ([0-9]?[0-9]:[0-9]{2})(:00)?(:[0-9]{2})?( [AP]M)?$/, ' <span class="eventTime">$1<span class="eventTimeDetails">$3 $4</span></span>') + "</p>";
			    }
			    result += event.alarm && event.alarm.containsKey("TRIGGER") ? '<p><span class="label">' + gTexts["alarm"] + ':</span>' + this.getTriggerString(event.getAlarmProperty("TRIGGER")) + "</p>" : "";
		    }

			// constructing the link
			if (event.properties.containsKey("URL"))
			{
		    	result += '<hr /><p class="header_url"><span class="label">' + (gTexts["url"] ? gTexts["url"] : "Url") + ':</span><a href="' + event.getProperty("URL") +'">' + this.toHtml(event.getProperty("URL")) + '</a></p>';
		    }
		    
			// constructing the description
			if (event.properties.containsKey("DESCRIPTION"))
			{
				var description = this.toHtml(event.getProperty("DESCRIPTION").replace(/^\s+/, ''));
                if (description && description.length > 0)
                {
    				description = description.replace(/(^|[^"])(http[s]?:[\/]{2}[^\s<>]+)/g, '$1<a href="$2">$2</a>');
    				description = description.replace(/(^|\s)([\w.]+@[\w.]+)/g, '$1<a href="$2">$2</a>');
    		    	result += '<hr /><p><span class="label">' + gTexts["description"] + ':</span><div class="description">' + description + "</div></p>";
                }
		    }
	    }
	    return result;
	}
	
	
	// Gets the link of calendar
	this.getCalendarLink = function(event)
	{
		if (event.calendarType.indexOf("Google") >= 0)
	    	return 'http://www.google.com/calendar/'

		if (event.calendarType.indexOf("Windows Live") >= 0)
	    	return 'http://calendar.live.com/'
	}
	
	
	// Removes slashes from string
	this.toHtml = function(value)
	{
		value = value.replace(/<[^ ]+>/gi, '');
        value = value.replace(/\n|[\\]n/gi, '<br />');
        value = value.replace(/\,|[\\],/g, ',')
        value = value.replace(/\;|[\\],/g, ';')
		return value;
	}
	
	
	// Returns the string of alarm trigger in poper format
	this.getTriggerString = function(trigger)
	{
		with(document)
		{
		    if (!trigger)
				return "0" + gTexts["m"] + " " + gTexts["before"];

		   	var dateValue = new Date(0, 0, 0, 0, 0, Math.abs(trigger));
	      	var result = "";
			if (Math.abs(trigger) >= 86400)
				result += Math.floor(Math.abs(trigger) / 86400) + gTexts["d"] + " ";
				
	      	if (dateValue.getHours() > 0)
	      	    result += dateValue.getHours() + gTexts["h"] + " ";

	      	if (dateValue.getMinutes() > 0)
	      	    result += dateValue.getMinutes() + gTexts["m"] + " ";

	      	if (dateValue.getSeconds() > 0)
	      	    result += dateValue.getSeconds() + gTexts["s"] + " ";

			return  result + (trigger < 0 ? gTexts["before"] : gTexts["after"]);
		}
	}
}