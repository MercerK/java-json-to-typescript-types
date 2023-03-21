import fs from 'fs'
import path from 'path'

type JavaClassMethod = {
  name: string
  params: Record<string, string>
  returnType: string
  isStatic: boolean
}

type JavaClassConstructor = {
  params: Record<string, string>
}

type JavaClass = {
  name: string
  superClass?: string
  constructors?: JavaClassConstructor[]
  methods: JavaClassMethod[]
  fields?: JavaClassField[]
}

type JavaClassField = {
  name: string
  type: string
  isStatic: boolean
}

const JSPrimitives = ['boolean', 'string', 'void']

function javaTypeToTs(type: string): string {
  if (type.includes('.')) {
    const splits = type.split('.')
    const last = splits.pop()
    const javaPackage = splits.join('.')

    if (!last) {
      throw new Error('Invalid type')
    }

    const newType = javaTypeToTs(last)

    if (!JSPrimitives.includes(newType)) {
      context.imports.add(`import { ${last} } from '${javaPackage}'`)
    }

    return javaTypeToTs(last)
  }

  switch (type) {
    case 'boolean':
      return 'boolean'
    case 'String':
      return 'string'
    case 'void':
      return 'void'
    default:
      return type
  }
}

const context = {
  imports: new Set<string>(),
}

const generateParameters = (params: Record<string, string>): string => {
  const result = Object.entries(params)
    .map(([name, type]) => `${name}: ${javaTypeToTs(type)}`)
    .join(', ')

  return result
}

const generateConstructors = (constructors: JavaClassConstructor[]): string => {
  let result = ''

  constructors.forEach((constructor: JavaClassConstructor) => {
    const params = generateParameters(constructor.params)
    result += `  constructor(${params});\n`
  })

  return result
}

const generateFields = (fields: JavaClassField[]): string => {
  let result = ''

  fields.forEach((field: JavaClassField) => {
    const fieldName = field.name
    const isStatic = field.isStatic ? 'static ' : ''
    const fieldType = javaTypeToTs(field.type)

    result += `  ${isStatic}${fieldName}: ${fieldType};\n`
  })

  return result
}

const generateClass = (javaClass: JavaClass): string => {
  const className = javaClass.name.split('.').pop()
  const superClass = javaClass.superClass ? ` extends ${javaTypeToTs(javaClass.superClass)}` : ''

  let result = `export class ${className}${superClass} {\n`

  if (javaClass.constructors) {
    result += generateConstructors(javaClass.constructors)
  }

  javaClass.methods.forEach((method: JavaClassMethod) => {
    const methodName = method.name
    const isStatic = method.isStatic ? 'static ' : ''
    const returnType = javaTypeToTs(method.returnType)
    const params = generateParameters(method.params)

    result += `  ${isStatic}${methodName}(${params}): ${returnType};\n`
  })

  if (javaClass.fields) {
    result += generateFields(javaClass.fields)
  }

  result += '}\n'
  return result
}

const generateImports = (imports: Set<string>): string => {
  let result = ''

  imports.forEach((importStatement) => {
    result += `${importStatement}\n`
  })

  return result
}

const sourcePath = path.join(__dirname, '..', 'JvTypeGen', 'output', 'json')

// could probably just change to fast-glob
const getAllFiles = (dirPath: string): string[] => {
  let fileList: string[] = []

  const files = fs.readdirSync(dirPath)

  files.forEach((file) => {
    const filePath = `${dirPath}/${file}`
    const stats = fs.statSync(filePath)

    if (stats.isDirectory()) {
      // recursively walk through subdirectories
      fileList = fileList.concat(getAllFiles(filePath))
    } else if (stats.isFile()) {
      // add file path to the list
      fileList.push(filePath)
    }
  })

  return fileList
}

const files = getAllFiles(sourcePath)

for (let file of files) {
  if (!file.endsWith('.json')) {
    continue
  }

  const json = JSON.parse(fs.readFileSync(file, 'utf8'))
  const result = generateClass(json)
  const imports = generateImports(context.imports)

  fs.writeFileSync(file.replace('.json', '.d.ts'), imports + '\n' + result)
  context.imports.clear()
}
