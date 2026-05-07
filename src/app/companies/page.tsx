'use client';

import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import { Plus, Edit, Trash2, MapPin, Phone, Mail } from 'lucide-react';

const CompaniesPage: React.FC = () => {
  const [showModal, setShowModal] = useState(false);

  const companies = [
    {
      id: '1',
      name: 'GulfZone Tech',
      email: 'info@tech.gulfzone.com',
      phone: '+971-4-123-4567',
      industry: 'Information Technology',
      city: 'Dubai',
      country: 'UAE',
      employee_count: 320,
      founded_year: 2015,
    },
    {
      id: '2',
      name: 'GulfZone Trading',
      email: 'info@trading.gulfzone.com',
      phone: '+971-4-234-5678',
      industry: 'Import/Export',
      city: 'Abu Dhabi',
      country: 'UAE',
      employee_count: 180,
      founded_year: 2010,
    },
    {
      id: '3',
      name: 'GulfZone Logistics',
      email: 'info@logistics.gulfzone.com',
      phone: '+971-6-345-6789',
      industry: 'Logistics & Distribution',
      city: 'Sharjah',
      country: 'UAE',
      employee_count: 150,
      founded_year: 2018,
    },
    {
      id: '4',
      name: 'GulfZone Consulting',
      email: 'info@consulting.gulfzone.com',
      phone: '+971-4-456-7890',
      industry: 'Management Consulting',
      city: 'Dubai',
      country: 'UAE',
      employee_count: 75,
      founded_year: 2019,
    },
  ];

  const columns = [
    {
      key: 'name',
      label: 'Company Name',
    },
    {
      key: 'industry',
      label: 'Industry',
    },
    {
      key: 'city',
      label: 'Location',
      render: (value: string, row: any) => `${value}, ${row.country}`,
    },
    {
      key: 'employee_count',
      label: 'Employees',
    },
    {
      key: 'founded_year',
      label: 'Founded',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: () => (
        <div className="flex gap-2">
          <button className="p-1 hover:bg-gray-200 rounded transition">
            <Edit size={18} className="text-gray-600" />
          </button>
          <button className="p-1 hover:bg-gray-200 rounded transition">
            <Trash2 size={18} className="text-red-600" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
            <p className="text-gray-600 mt-1">Manage all companies under GulfZone Group</p>
          </div>
          <Button variant="primary" onClick={() => setShowModal(true)} className="gap-2">
            <Plus size={20} />
            Add Company
          </Button>
        </div>

        {/* Company Cards Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {companies.map((company) => (
            <Card key={company.id} className="hover:shadow-lg transition">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{company.name}</h3>
                  <p className="text-sm text-gray-600">{company.industry}</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-700">
                    <MapPin size={16} className="text-blue-600" />
                    <span>{company.city}, {company.country}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Phone size={16} className="text-blue-600" />
                    <span>{company.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Mail size={16} className="text-blue-600" />
                    <span className="truncate">{company.email}</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Employees</span>
                    <span className="font-semibold text-gray-900">{company.employee_count}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Detailed Table */}
        <Card header={<h2 className="text-lg font-semibold">All Companies</h2>} noPadding>
          <Table columns={columns} data={companies} />
        </Card>
      </div>

      {/* Add Company Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add New Company"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary">
              Add Company
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Company Name" placeholder="Enter company name" />
          <Input label="Email" type="email" placeholder="Enter company email" />
          <Input label="Phone" placeholder="Enter phone number" />
          <Input label="Industry" placeholder="Enter industry" />
          <div className="grid grid-cols-3 gap-4">
            <Input label="City" placeholder="Enter city" />
            <Input label="Country" placeholder="Enter country" />
            <Input label="Founded Year" type="number" placeholder="Enter year" />
          </div>
          <Input label="Address" placeholder="Enter full address" />
        </div>
      </Modal>
    </Layout>
  );
};

export default CompaniesPage;
