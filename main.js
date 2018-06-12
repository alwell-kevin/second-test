var base_url = "https://memessaging-gateway.herokuapp.com"
var ACTIVE_CONVERSATION = {},
    USERS, WEB_ACTIVE_USER, MOBILE_ACTIVE_USER, CONV_CLIENT;

$(document).ready(function() {
    $("#call").click(function() {})
})


//On Load Functions
function getUsers() {
    return new Promise( /* executor */ function(resolve, reject) {
        $.ajax({
            url: base_url + '/users',
            type: 'GET',
            dataType: 'jsonp',
            success: function(data) {
                resolve(data)
            },
            error: function(err) {
                console.log('Failed!', err);
            }
        });
    })
}

function createUser(userName) {
    return new Promise( /* executor */ function(resolve, reject) {
        $.ajax({
            url: base_url + '/users',
            type: 'POST',
            dataType: 'json',
            data: {
                "username": userName,
                "admin": true
            },
            success: function(data) {
                user = {}
                user.user_jwt = data.user_jwt
                user.name = userName;
                user.id = data.user.id
                resolve(user)
            },
            error: function(err) {
                err = JSON.parse(err);

                console.log('Create User Failed! ', err);
                resolve(err)
            }
        });
    })
}


function getUserJwt(userId) {
    return new Promise(function(resolve, reject) {
        $.ajax({
            url: base_url + '/jwt/' + userId,
            type: 'GET',
            dataType: 'jsonp',
            data: {
                "admin": true
            },
            success: function(data) {
                console.log("JWT Success", data);
                resolve(data)
            },
            error: function(err) {
                console.log('JWT Failed!', err);
                reject(err)
            }
        });
    })
}

function createConversation(displayName) {
    $.ajax({
        url: base_url + '/conversations',
        type: 'POST',
        dataType: 'json',
        data: {
            "displayName": displayName
        },
        success: function(data) {
            console.log("CREATED CONVERSATION: ", data)
            return data
        },
        error: function(err) {
            console.log('Failed!', err);
        }
    });
}


function getConversations() {
    return new Promise( /* executor */ function(resolve, reject) {
        $.ajax({
            url: base_url + '/conversations',
            type: 'GET',
            dataType: 'json',
            success: function(data) {
                console.log("Conversations:", data._embedded.conversations);
                resolve(data._embedded.conversations)
            },
            error: function(err) {
                console.log('Failed!', err);
            }
        });
    })
}

function addUserToConversation(activeUser, conversation) {
    return new Promise( /* executor */ function(resolve, reject) {
        $.ajax({
            url: base_url + '/conversationmember',
            type: 'GET',
            dataType: 'jsonp',
            data: {
                conversationId: conversation.uuid,
                userId: activeUser.id,
                action: "join"
            },
            success: function(data) {
                if (data.body && data.body.code === "conversation:error:member-already-joined") {
                    data = { "status": "success" }
                }

                resolve(data)
            },
            error: function(err) {
                console.log('Failed! addUserToConversation', err);
                reject(err);
            }
        });
    })
}

//Initialize Application
var onLoad = function() {
    return new Promise((resolve, reject) => {
        //Get Conversations
        getConversations().then(function(convList) {
            if (convList.length > 0) {
                ACTIVE_CONVERSATION = convList[0]

                //Get Users
                getUsers().then(function(userList) {
                    USERS = userList;
                    if (USERS.length > 2) {
                        WEB_ACTIVE_USER = userList[0];
                        MOBILE_ACTIVE_USER = userList[1];
                        //GET ACTIVE_USER JWT
                        getUserJwt(WEB_ACTIVE_USER.name).then(function(jwt) {
                            WEB_ACTIVE_USER.jwt = jwt;
                            //Add ACTIVE_USER to conversation
                            addUserToConversation(WEB_ACTIVE_USER, ACTIVE_CONVERSATION).then(function(data) {
                                console.log("active User added to active Conversation", data);
                            })

                            addUserToConversation(MOBILE_ACTIVE_USER, ACTIVE_CONVERSATION).then(function(data) {
                                console.log("active User added to active Conversation", data);
                                //COMPLETE ON-LOAD
                                resolve()
                            })
                        })

                        getUserJwt(MOBILE_ACTIVE_USER.name).then(function(jwt) {
                            MOBILE_ACTIVE_USER.jwt = jwt;

                            addUserToConversation(MOBILE_ACTIVE_USER, ACTIVE_CONVERSATION).then(function(data) {
                                console.log("active MOBILE User added to active Conversation", data);
                            })
                        })


                    } else {
                        createUser("activeUser" + Math.random()).then(function(user) {
                            onLoad();
                        })
                        console.log("NEED TO CREATE USER - No active user.")
                    }

                    console.log("USERS: ", USERS)
                })
            } else {
                ACTIVE_CONVERSATION = createConversation("active-conversation");
            }

            console.log("CONVERSATION: ", ACTIVE_CONVERSATION)
        });
    });
}

class ChatApp {
    constructor() {
        // this.messageTextarea = document.getElementById('messageTextarea')
        // this.messageFeed = document.getElementById('messageFeed')
        // this.sendButton = document.getElementById('send')
        this.audio = document.getElementById('audio')
        this.enableButton = document.getElementById('enable')
        this.disableButton = document.getElementById('disable')
        this.callControls = document.getElementById('call-controls')
        this.hangUpButton = document.getElementById('hang-up')
        this.callMembers = document.getElementById('call-members')
        this.callPhoneForm = document.getElementById('call-phone-form')

        this.setupUserEvents();
        if (window.location.search.includes("launch")) {
            localStorage.setItem("active_user", JSON.stringify(WEB_ACTIVE_USER));
            this.joinConversation(WEB_ACTIVE_USER.jwt.user_jwt);
        } else {
            JSON.parse(localStorage.getItem('active_user'));
            localStorage.setItem("active_user", JSON.stringify(MOBILE_ACTIVE_USER));
            this.joinConversation(MOBILE_ACTIVE_USER.jwt.user_jwt);
        }
    }

    handleCall(call) {
        this.setupAudioStream(call.application.activeStream.stream)
        this.call = call
        call.on("call:member:state", (from, state, event) => {
            if (state = "ANSWERED") {
                this.showCallControls(from)
            }
            console.log("member: " + from.user.name + " has " + state);
        });
    }

    errorLogger(error) {
        console.log(error)
    }

    eventLogger(event) {
        return () => {
            console.log("'%s' event was sent", event)
        }
    }

    authenticate() {
        var user = JSON.parse(localStorage.getItem('active_user'));
        return user.jwt
    }

    setupConversationEvents(conversation) {
        this.conversation = conversation
        console.log('*** Conversation Retrieved', conversation)
        console.log('*** Conversation Member', conversation.me)
        if (conversation.me.state === "JOINED") { window.alert("Begin") }

        // Bind to events on the conversation
        conversation.on('text', (sender, message) => {
            console.log('*** Message received', sender, message)
        })

        conversation.on("member:media", (member, event) => {
            console.log(`*** Member changed media state`, member, event)
        })
    }

    joinConversation(userToken) {
        new ConversationClient({ debug: false })
            .login(userToken)
            .then(app => {
                this.app = app

                this.app.on("member:call", (member, call) => {
                    if (window.confirm(`Incoming call from ${member.user.name}. Do you want to answer?`)) {
                        this.call = call
                        call.answer().then((stream) => {
                            this.setupAudioStream(stream)
                            this.showCallControls(member)
                        })
                    } else {
                        call.hangUp()
                    }
                })
                return app.getConversation(ACTIVE_CONVERSATION.uuid)
            })
            .then(this.setupConversationEvents.bind(this))
            .catch(this.errorLogger)
    }

    setupAudioStream(stream) {
        // Older browsers may not have srcObject
        if ("srcObject" in this.audio) {
            this.audio.srcObject = stream;
        } else {
            // Avoid using this in new browsers, as it is going away.
            this.audio.src = window.URL.createObjectURL(stream);
        }

        this.audio.onloadedmetadata = () => {
            this.audio.play();
        }
    }

    showCallControls(member) {
        this.callControls.style.display = "block"
        this.callMembers.textContent = this.callMembers.textContent + " " + member.invited_by || member.user.name
    }

    setupUserEvents() {
        this.disableButton.addEventListener('click', () => {
            this.conversation.media.disable().then(this.eventLogger('member:media')).catch(this.errorLogger)
        })

        this.callPhoneForm.addEventListener('submit', (event) => {
            event.preventDefault()
            this.app.callPhone(this.callPhoneForm.children.phonenumber.value)
                .then(this.handleCall)
        })

        this.hangUpButton.addEventListener('click', () => {
            this.call.hangUp()
            this.callControls.style.display = "none"
        })


        this.enableButton.addEventListener('click', () => {

            this.conversation.media.enable().then(stream => {
                this.setupAudioStream(stream)

                this.eventLogger('member:media')()
            }).catch(this.errorLogger)
        })

        this.enableButton.addEventListener('click', () => {
            this.conversation.media.enable().then(stream => {
                // Older browsers may not have srcObject
                if ("srcObject" in this.audio) {
                    this.audio.srcObject = stream;
                } else {
                    // Avoid using this in new browsers, as it is going away.
                    this.audio.src = window.URL.createObjectURL(stream);
                }

                this.audio.onloadedmetadata = () => {
                    this.audio.play();
                }

                this.eventLogger('member:media')()
            }).catch(this.errorLogger)
        })
    }

    showConversationHistory(conversation) {

        switch (value.type) {
            case 'member:media':
                eventsHistory = `${conversation.members[value.from].user.name} @ ${date}: <b>${value.body.audio ? "enabled" : "disabled"} audio</b><br>` + eventsHistory
                break;
        }
    }
}


onLoad().then(function() {
    new ChatApp()
})