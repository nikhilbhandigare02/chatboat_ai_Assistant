import React from 'react';
import patientsData from '../data/patients.json';

export const PatientSelector = ({ selectedPatient, onPatientChange }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Patient
      </label>
      <select
        value={selectedPatient?.id || ''}
        onChange={(e) => {
          const patientId = parseInt(e.target.value);
          const patient = patientsData.patients.find(p => p.id === patientId);
          onPatientChange(patient);
        }}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
      >
        <option value="">-- Select a patient --</option>
        {patientsData.patients.map((patient) => (
          <option key={patient.id} value={patient.id}>
            {patient.name} - {patient.policyId} ({patient.plan})
          </option>
        ))}
      </select>

      {selectedPatient && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="font-medium text-gray-600">Name:</span>
              <p className="text-gray-900">{selectedPatient.name}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Policy ID:</span>
              <p className="text-gray-900">{selectedPatient.policyId}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Plan:</span>
              <p className="text-gray-900">{selectedPatient.plan}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Coverage:</span>
              <p className="text-gray-900">₹{selectedPatient.coverageLimit.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
