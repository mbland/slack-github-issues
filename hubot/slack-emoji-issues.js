// Description:
//   Uses the Slack Real Time Messaging API to file issues from emoji reactions
//
// Configuration:
//   HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH
//   HUBOT_GITHUB_TOKEN
//   HUBOT_SLACK_TOKEN

'use strict'

var path = require('path')
var slackGitHubIssues = require('..')

// Remove this block and close #15 when slackapi/hubot-slack#429 is done.
require('hubot-slack')
var CoffeeScriptCompatibleHubot = require('hubot')
var Hubot = require('hubot/es2015')
Hubot.Robot.prototype.react = CoffeeScriptCompatibleHubot.Robot.prototype.react

function configParams() {
  var params = {updates: {}}

  params.path = process.env.HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH ||
    path.join('config', 'slack-emoji-issues.json')

  params.updates.slackApiToken = process.env.HUBOT_SLACK_TOKEN
  params.updates.githubApiToken = process.env.HUBOT_GITHUB_TOKEN

  return params
}

function slackDataStore(robot) {
  // This may be undefined when running under test.
  if (robot.adapter.client) {
    return slackGitHubIssues.slackRtmDataStore(robot.adapter.client)
  }
}

function fileIssue(robot, filer, response) {
  // ReactionMessage (node_modules/hubot-slack/src/reaction-message.coffee) will
  // trim the 'reaction_' prefix from 'reaction_added'. The slack-emoji-issues
  // library requires we put it back.
  response.message.type = 'reaction_' + response.message.type

  filer.execute(response.message)
    .then(function(issueUrl) {
      response.reply('created: ' + issueUrl)
      robot.emit(response.message.type, { err: null, created: issueUrl })
    })
    .catch(function(err) {
      if (err) {
        err = err.message || err
        response.reply(err)
      }
      robot.emit(response.message.type, { err: err, created: null })
    })
}

module.exports = function(robot) {
  var logger = robot.logger,
      filer,
      listener = function(response) {
        fileIssue(robot, filer, response)
      }

  try {
    logger = slackGitHubIssues.logger(logger)
    filer = slackGitHubIssues.singleInstanceReactionIssueFiler(
      configParams(), slackDataStore(robot), logger)
    listener.impl = filer

    robot.react(listener)
    logger.info(null, 'listening for reaction_added events')

  } catch (err) {
    logger.error(null, 'reaction_added listener registration failed:',
      err instanceof Error ? err.message : err)
  }
}
