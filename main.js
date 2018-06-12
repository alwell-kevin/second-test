var base_url = "https://memessaging-gateway.herokuapp.com"
var ACTIVE_CONVERSATION = {},
    USERS, WEB_ACTIVE_USER, MOBILE_ACTIVE_USER;

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
        dataType: 'jsonp',
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
            dataType: 'jsonp',
            success: function(data) {
                console.log("Conversations:", data._embedded.conversations);
                resolve(data)
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
                if (data.body.code === "conversation:error:member-already-joined") {
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
        CONVERSATIONS = getConversations().then(function(convList) {
            if (convList.count > 0) {
                ACTIVE_CONVERSATION = convList._embedded.conversations[0];

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
                                //COMPLETE ON-LOAD
                                resolve()
                            })

                            addUserToConversation(MOBILE_ACTIVE_USER, ACTIVE_CONVERSATION).then(function(data) {
                                console.log("active User added to active Conversation", data);
                            })
                        })

                        getUserJwt(MOBILE_ACTIVE_USER.name).then(function(jwt) {
                            MOBILE_ACTIVE_USER.jwt = jwt;

                            addUserToConversation(MOBILE_ACTIVE_USER, ACTIVE_CONVERSATION).then(function(data) {
                                console.log("active MOBILE User added to active Conversation", data);
                            })
                        })


                    } else {
                        createUser("activeUser" + math.random()).then(function(user) {
                            onLoad();
                        })
                        console.log("NEED TO CREATE USER - No active user.")
                    }

                    console.log("USERS: ", USERS)
                })
            } else {
                CONVERSATIONS = createConversation("active-conversation");
            }

            console.log("CONVERSATIONS: ", CONVERSATIONS)
        });
    });
}

class ChatApp {
    constructor() {
        this.messageTextarea = document.getElementById('messageTextarea')
        this.messageFeed = document.getElementById('messageFeed')
        this.sendButton = document.getElementById('send')
        this.setupUserEvents();
        this.joinConversation(WEB_ACTIVE_USER.jwt.user_jwt);
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
        return ACTIVE_USER.jwt
    }

    setupConversationEvents(conversation) {
        this.conversation = conversation
        console.log('*** Conversation Retrieved', conversation)
        console.log('*** Conversation Member', conversation.me)

        // Bind to events on the conversation
        conversation.on('text', (sender, message) => {
            console.log('*** Message received', sender, message)
            const date = new Date(Date.parse(message.timestamp))
            const text = `${sender.user.name} @ ${date}: <b>${message.body.text}</b><br>`
            this.messageFeed.innerHTML = text + this.messageFeed.innerHTML
        })
    }

    joinConversation(userToken) {
        new ConversationClient({ debug: false })
            .login(userToken)
            .then(app => {
                console.log('*** Logged into app', app)
                return app.getConversation(ACTIVE_CONVERSATION.uuid)
            })
            .then(this.setupConversationEvents.bind(this))
            .catch(this.errorLogger)
    }

    setupUserEvents() {
        this.sendButton.addEventListener('click', () => {
            this.conversation.sendText(this.messageTextarea.value).then(() => {
                this.eventLogger('text')()
                this.messageTextarea.value = ''
            }).catch(this.errorLogger)
        })
    }
}

onLoad().then(function() {
    new ChatApp()
})