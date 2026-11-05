import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default function configSchemaF() {
  return ConfigurationSchema(
    'OrthoFinderMsaAdapter',
    {
      resultsLocation: {
        type: 'fileLocation',
        description:
          'the Results_* folder of an OrthoFinder run, holding Orthogroups/, MultipleSequenceAlignments/ and Resolved_Gene_Trees/',
        defaultValue: {
          uri: '/path/to/Results',
          locationType: 'UriLocation',
        },
      },
    },
    { explicitlyTyped: true },
  )
}
