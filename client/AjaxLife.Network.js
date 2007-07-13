/* Copyright (c) 2007, Katharine Berry
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Katharine Berry nor the names of any contributors
 *       may be used to endorse or promote products derived from this software
 *       without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY KATHARINE BERRY ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL KATHARINE BERRY BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 ******************************************************************************/

AjaxLife.Network.init = function() {
	AjaxLife.Network.MessageQueue.init();
};

AjaxLife.Network.logout = function(hidemessage) {
	var hanging = false;
	if(!hidemessage)
	{
		hanging = Ext.Msg.wait(_("Network.LoggingOut"));
	}
	var link = new Ext.data.Connection();
	link.request({
		url: "logout.kat",
		method: "POST",
		params: {
			sid: gSessionID
		},
		callback: function(options, success, response)
		{
			if(success)
			{
				AjaxLife.Network.MessageQueue.shutdown();
				if(!hidemessage)
				{
					hanging.hide();
					Ext.Msg.show({
						closable: false,
						title: "",
						msg: _("Network.LogoutSuccess"),
						modal: true,
						buttons: false
					});
				}
			}
			else
			{
				Ext.Msg.alert(_("Network.Error"),_("Network.LogoutError"));
			}
		}
	});
};

AjaxLife.Network.MessageQueue = function() {
	// Private
	var requesting = false;
	var link = new Ext.data.Connection({timeout: 60000});
	var timer = false;
	var callbacks = {};
	var temp_storage = new Array();
	
	function processqueue(queue) {
		queue.each(function(item) {
			var handled = false;
			if(callbacks[item.MessageType])
			{
				try
				{
					callbacks[item.MessageType].each(function(callback) {
						callback(item);
					});
					handled = true;
				}
				catch(e)
				{
					AjaxLife.Widgets.Ext.msg("Error",e);
				}
			}
			if(item.MessageType == 'InstantMessage')
			{
				if(item.Dialog == AjaxLife.Constants.MainAvatar.InstantMessageDialog.InventoryOffered)
				{
					/*
					Ext.Msg.show({
						title:"New inventory",
						msg: item.FromAgentName+" gave you "+item.Message,
						buttons: {
							yes: "Accept",
							no: "Decline"
						},
						modal: false,
						closable: false,
						fn: function(btn) {
							if(btn == "yes")
							{
								AjaxLife.SpatialChat.addline("Second Life",item.FromAgentName+" gave you "+item.Message, AjaxLife.Constants.MainAvatar.ChatSource.System, AjaxLife.Constants.MainAvatar.ChatType.Normal);
								AjaxLife.Network.Send("GenericInstantMessage", {
									Target: item.FromAgentID,
									Message: item.Message,
									IMSessionID: item.IMSessionID,
									Dialog: AjaxLife.Constants.MainAvatar.InstantMessageDialog.InventoryAccepted,
									Online: AjaxLife.Constants.MainAvatar.InstantMessageOnline.Offline,
									X: 0,
									Y: 0,
									Z: 0
								});
							}
						}
					});
					*/
					AjaxLife.Widgets.Ext.msg("",_("Network.ReceiveInventory", {name: item.FromAgentName, item: item.Message}));
				}
			}
			else if(item.MessageType == 'Disconnected')
			{
				if(item.Reason != AjaxLife.Constants.NetworkManager.DisconnectType.ClientInitiated)
				{
					AjaxLife.Network.logout(true);
					Ext.Msg.show({
						closable: false,
						title: _("Network.Disconnected"),
						msg: _("Network.LogoutForced", {reason: item.Message}),
						modal: true,
						buttons: false
					});
				}
			}
			else if(item.MessageType == 'MoneyBalanceReplyReceived')
			{
				AjaxLife.Widgets.Ext.msg(_("StatusBar.Money"),item.Description);
			}
			else if(!handled)
			{
				var parsed = '';
				for(var i in item)
				{
					parsed += i+': '+item[i]+'<br />';
				}
				AjaxLife.Widgets.Ext.msg(_("Network.UnhandledMessage"),parsed);
			}
		});
	};
	
	function requestqueue() {
		if(requesting) return;
		
		requesting = true;
		link.request({
			url: "eventqueue.kat",
			method: "POST",
			params: {
				sid: gSessionID
			},
			callback: function(options, success, response) {
				if(success)
				{
					//AjaxLife.Widgets.Ext.msg("Message Queue",response.responseText);
					try
					{
						var data = Ext.util.JSON.decode(response.responseText);
					}
					catch(e)
					{
						// Meep.
						return;
					}
					processqueue(data);
				}
				else
				{
					AjaxLife.Widgets.Ext.msg(_("Network.Error"),_("Network.EventQueueFailure"));
				}
				requesting = false;
			}
		});
	};	
	
	return {
		// Public
		init: function() {
			timer = setInterval(requestqueue,1000);
		},
		shutdown: function() {
			clearInterval(timer);
			link.abort();
		},
		RegisterCallback: function(message, callback) {
			if(!callbacks[message]) {
				callbacks[message] = new Array();
			};
			callbacks[message][callbacks[message].length] = callback;
		}
	};
}();

AjaxLife.Network.Send = function(message, opts) {
	var link = new Ext.data.Connection({timeout: 60000});
	opts.sid = gSessionID;
	opts.MessageType = message;
	var callbackf = false;
	if(opts.callback)
	{
		callbackf = opts.callback;
		opts.callback = null;
	}
	params = {
		url: "sendmessage.kat",
		method: "POST",
		params: opts
	};
	if(callbackf)
	{
		params.callback = function(options, success, response) {
			if(success)
			{
				try
				{
					var data = Ext.util.JSON.decode(response.responseText);
					callbackf(data);
				}
				catch(e)
				{
					callbackf(response.responseText);
				}
			}
			else
			{
				AjaxLife.Widgets.Ext.msg(_("Network.Error"),_("Network.GenericSendError"));
			}
		};
	}
	link.request(params);
};