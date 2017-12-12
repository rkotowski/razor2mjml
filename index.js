#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const vash = require('vash')
const mjml = require('mjml')

// -----------------------------------------------------------------------------
// Parsing command line arguments
// -----------------------------------------------------------------------------

const argv = require('minimist')(process.argv.slice(2))

if (argv.h || argv.help) {
  return console.log(`usage: ${path.basename(process.argv[1])} [ -i <filename> ] [--mode html|mjml|email]`)
}

const input = argv.i || 'Layout.cshtml'

if (!fs.existsSync(input)) {
  return console.error(`[Converter] specified input file '${input}' does not exist`)
}

const mode = argv.mode || 'email'
const renderFinalEmail = mode === 'email'

// -----------------------------------------------------------------------------
// Definition of Model
// -----------------------------------------------------------------------------

const model = {
  // this is needed so that we can steer the rendering to either html or mjml
  Sitecore: {
    Context: {
      PageMode: {
        IsExperienceEditor: mode === 'html'
      }
    }
  },
}

// this is needed because we're using 'useWith' Vash option to allow accessing
// model via @Model again.
model.Model = model

// -----------------------------------------------------------------------------
// Definition of Sitecore content
// -----------------------------------------------------------------------------

const placeholders = {
  head: [ {
    template: 'Styles.cshtml'
  } ],
  content: [ {
    template: 'Header.cshtml',
    model: {
      Title: 'Hello, world!!!',
      Image: 'http://www.online-image-editor.com//styles/2014/images/example_image.png',
    }
  } ]
}

// -----------------------------------------------------------------------------
// Processing engine
// -----------------------------------------------------------------------------

function compile (template, model) {
  let tpl = vash.compile(template)
  return tpl(model)
}

function removeUnsupportedTags(template) {
  return template.replace(/\@model .*?\n/g, '')
}

function renderTemplate (filename, model) {
  const template = removeUnsupportedTags(fs.readFileSync(filename, 'utf8'))
  return compile(template, model)
}

function renderPlaceholderComponent (component) {
  return renderTemplate(component.template, Object.assign(model, component.model))
}

function renderPlaceholder (name) {
  if (placeholders[name] instanceof Array) {
    return placeholders[name].map(renderPlaceholderComponent).join('\n')
  } else {
    return `[placeholder-${name}]`
  }
}

// -----------------------------------------------------------------------------
// Matching Vash interface with Razor and Sitecore
// -----------------------------------------------------------------------------

vash.config.helpersName = 'Html'
vash.config.modelName = 'Model'
vash.config.htmlEscape = false

// we are using this option to be able to add to the global namespace objects
// like Sitecore and to provide a common interface with the real environment
vash.config.useWith = true

vash.helpers.Include = vash.helpers.include
vash.helpers.Partial = renderTemplate
vash.helpers.RenderPartial = renderTemplate
vash.helpers.Sitecore = () => ({
  Placeholder: renderPlaceholder,
  DynamicPlaceholder: name => `[dynamic-placeholder-${name}]`,
})

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

function renderEmailMessageFromMjml (source) {
  try {
    const output = mjml.mjml2html(source);
    if (output.errors.length > 0) {
      output.errors.forEach(error => console.error(error))
      process.exit(1)
    } else {
      return output.html
    }
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}

const source = renderTemplate(input, model)
console.log(renderFinalEmail ? renderEmailMessageFromMjml(source) : source)
