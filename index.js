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
  return console.log(`usage: ${path.basename(process.argv[1])} -i <filename> [--mode html|mjml|email]`)
}

if (!argv.i) {
  return console.error(`[Converter] no input file specified (-i <filename>)`)
}

const input = argv.i

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
  Title: 'Hello, world!!!',
  Image: 'http://www.online-image-editor.com//styles/2014/images/example_image.png',
}

// -----------------------------------------------------------------------------
// Matching Vash interface with Razor and Sitecore
// -----------------------------------------------------------------------------

vash.config.helpersName = 'Html'
vash.config.modelName = 'Model'

// we are using this option to be able to add to the global namespace objects
// like Sitecore and to provide a common interface with the real environment
vash.config.useWith = true

vash.helpers.Include = vash.helpers.include
vash.helpers.Partial = vash.helpers.include
vash.helpers.RenderPartial = vash.helpers.include
vash.helpers.Sitecore = () => ({
  Placeholder: name => placeholders[name] || `[placeholder-${name}]`,
  DynamicPlaceholder: name => `[dynamic-placeholder-${name}]`,
})

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

function compile (template, model) {
  if (renderFinalEmail) {
    template = `<mjml><mj-body><mj-container>\n${template}</mj-container></mj-body></mjml>`
  }
  let tpl = vash.compile(template)
  return tpl(model)
}

function render (source) {
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

fs.readFile(input, 'utf8', (err, template) => {
  if (err) return console.error(err);

  const source = compile(template, model)
  console.log(renderFinalEmail ? render(source) : source)
});
